import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AdjustmentStatus, MovementType } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [batches, medicinesCount, movementsCount] = await Promise.all([
      this.prisma.medicineBatch.findMany({
        where: { status: 'ACTIVE', quantityOnHand: { gt: 0 } },
        select: { costPrice: true, sellingPrice: true, quantityOnHand: true, expiryDate: true }
      }),
      this.prisma.medicine.count({ where: { isActive: true, deletedAt: null } }),
      this.prisma.stockMovement.count()
    ]);

    let totalValuationAtCost = 0;
    let totalValuationAtRetail = 0;
    let totalUnitsOnHand = 0;
    const now = new Date();
    const sixtyDays = new Date();
    sixtyDays.setDate(sixtyDays.getDate() + 60);
    let nearExpiryBatches = 0;

    for (const b of batches) {
      const qty = Number(b.quantityOnHand);
      totalUnitsOnHand += qty;
      totalValuationAtCost += Number(b.costPrice) * qty;
      totalValuationAtRetail += Number(b.sellingPrice) * qty;
      if (b.expiryDate >= now && b.expiryDate <= sixtyDays) {
        nearExpiryBatches++;
      }
    }

    return {
      activeMedicines: medicinesCount,
      activeBatches: batches.length,
      totalUnitsOnHand,
      totalValuationAtCost,
      totalValuationAtRetail,
      potentialGrossMargin: totalValuationAtRetail - totalValuationAtCost,
      nearExpiryBatches,
      totalStockMovements: movementsCount,
      currency: process.env.DEFAULT_CURRENCY || 'LKR'
    };
  }

  async getMovements(page = 1, limit = 50, batchId?: string, movementType?: MovementType) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (batchId) where.batchId = BigInt(batchId);
    if (movementType) where.movementType = movementType;

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        include: {
          batch: {
            include: { medicine: { select: { name: true, brandName: true, skuCode: true } } }
          },
          user: { select: { fullName: true, username: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.stockMovement.count({ where })
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  async createAdjustment(userId: string, data: { reason: any; notes?: string; items: Array<{ batchId: string; physicalQuantity: number }> }) {
    const userBigInt = BigInt(userId);

    return await this.prisma.$transaction(async (tx) => {
      const adjustmentNumber = `ADJ-${Date.now()}`;
      const itemsToCreate = [];

      for (const item of data.items) {
        const batch = await tx.medicineBatch.findUnique({
          where: { id: BigInt(item.batchId) }
        });
        if (!batch) throw new NotFoundException(`Batch ${item.batchId} not found`);

        const systemQty = Number(batch.quantityOnHand);
        const variance = item.physicalQuantity - systemQty;

        itemsToCreate.push({
          batchId: batch.id,
          systemQuantity: systemQty,
          physicalQuantity: item.physicalQuantity,
          variance: variance,
          unitCostSnapshot: batch.costPrice
        });
      }

      return await tx.stockAdjustment.create({
        data: {
          adjustmentNumber,
          reason: data.reason,
          status: AdjustmentStatus.PENDING,
          createdBy: userBigInt,
          notes: data.notes || null,
          items: {
            create: itemsToCreate
          }
        },
        include: { items: true }
      });
    });
  }

  async approveAdjustment(adjustmentId: string, approverId: string) {
    const approverBigInt = BigInt(approverId);

    return await this.prisma.$transaction(async (tx) => {
      const adj = await tx.stockAdjustment.findUnique({
        where: { id: BigInt(adjustmentId) },
        include: { items: true }
      });
      if (!adj) throw new NotFoundException('Adjustment not found');

      for (const item of adj.items) {
        // Update batch to physical quantity
        const updatedBatch = await tx.medicineBatch.update({
          where: { id: item.batchId },
          data: { quantityOnHand: item.physicalQuantity }
        });

        // Determine appropriate movement type based on adjustment reason
        let mType: MovementType = MovementType.PHYSICAL_COUNT_VARIANCE;
        if (adj.reason === 'DAMAGED_IN_STORE' || adj.reason === 'EXPIRED_DISPOSAL') {
          mType = MovementType.ADJUSTMENT_DAMAGE;
        } else if (adj.reason === 'THEFT_OR_LOSS') {
          mType = MovementType.ADJUSTMENT_LOST;
        }

        // Append movement ledger
        await tx.stockMovement.create({
          data: {
            batchId: item.batchId,
            movementType: mType,
            quantityDelta: item.variance,
            balanceAfter: updatedBatch.quantityOnHand,
            referenceType: 'STOCK_ADJUSTMENT',
            referenceId: adj.id,
            userId: approverBigInt,
            note: `Adjustment #${adj.adjustmentNumber}: ${adj.reason}${adj.notes ? ` - ${adj.notes}` : ''}`
          }
        });
      }

      return await tx.stockAdjustment.update({
        where: { id: adj.id },
        data: {
          status: AdjustmentStatus.APPROVED,
          approvedBy: approverBigInt
        }
      });
    });
  }

  async getAdjustments(status?: AdjustmentStatus) {
    const where: any = {};
    if (status) where.status = status;

    return await this.prisma.stockAdjustment.findMany({
      where,
      include: {
        creator: { select: { id: true, fullName: true, username: true } },
        approver: { select: { id: true, fullName: true, username: true } },
        items: {
          include: {
            batch: {
              include: {
                medicine: { select: { id: true, name: true, brandName: true, skuCode: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}

