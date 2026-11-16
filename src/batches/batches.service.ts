import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { BatchStatus, MovementType } from '@prisma/client';

@Injectable()
export class BatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(medicineId?: string, status?: BatchStatus, expiringDays?: number) {
    const where: any = {};

    if (medicineId) {
      where.medicineId = BigInt(medicineId);
    }

    if (status) {
      where.status = status;
    }

    if (expiringDays) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + Number(expiringDays));
      where.expiryDate = {
        gte: new Date(),
        lte: targetDate
      };
      where.quantityOnHand = { gt: 0 };
    }

    return await this.prisma.medicineBatch.findMany({
      where,
      include: {
        medicine: {
          select: {
            id: true,
            name: true,
            brandName: true,
            strength: true,
            skuCode: true,
            barcode: true,
            dosageForm: true,
            wholesalePrice: true,
            purchasePrice: true,
            sellingPrice: true,
            reorderLevel: true,
            maxStockLevel: true,
            rackLocation: true,
            warehouseLocation: true,
            storageCondition: true,
            lowStockAlert: true,
            expiryAlert: true
          }
        }
      },
      orderBy: { expiryDate: 'asc' } // FEFO ordering
    });
  }

  async getFefoBatches(medicineId: string) {
    return await this.prisma.medicineBatch.findMany({
      where: {
        medicineId: BigInt(medicineId),
        status: BatchStatus.ACTIVE,
        quantityOnHand: { gt: 0 },
        expiryDate: { gt: new Date() } // Lock out expired batches
      },
      orderBy: { expiryDate: 'asc' } // Earliest expiry first
    });
  }

  async allocateFefo(medicineId: string, requestedQty: number) {
    const batches = await this.getFefoBatches(medicineId);

    const allocations: Array<{
      batchId: string;
      batchNumber: string;
      expiryDate: string;
      unitPrice: number;
      allocatedQty: number;
    }> = [];

    let remainingToAllocate = requestedQty;

    for (const b of batches) {
      if (remainingToAllocate <= 0) break;

      const available = Number(b.quantityOnHand);
      const toTake = Math.min(available, remainingToAllocate);

      allocations.push({
        batchId: b.id.toString(),
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate.toISOString(),
        unitPrice: Number(b.sellingPrice),
        allocatedQty: toTake
      });

      remainingToAllocate -= toTake;
    }

    return {
      medicineId,
      requestedQty,
      isFullyAllocated: remainingToAllocate <= 0,
      shortfall: remainingToAllocate > 0 ? remainingToAllocate : 0,
      allocations
    };
  }

  async quarantineBatch(id: string, reason?: string) {
    const batch = await this.prisma.medicineBatch.findUnique({
      where: { id: BigInt(id) }
    });
    if (!batch) throw new NotFoundException('Batch not found');

    return await this.prisma.medicineBatch.update({
      where: { id: batch.id },
      data: { status: BatchStatus.QUARANTINED }
    });
  }

  async create(dto: CreateBatchDto, userId?: string) {
    const expiry = new Date(dto.expiryDate);
    if (expiry <= new Date()) {
      throw new BadRequestException('Cannot create a batch that is already expired');
    }

    const mfg = dto.mfgDate ? new Date(dto.mfgDate) : null;

    const batch = await this.prisma.medicineBatch.create({
      data: {
        medicineId: BigInt(dto.medicineId),
        batchNumber: dto.batchNumber,
        mfgDate: mfg,
        expiryDate: expiry,
        costPrice: dto.costPrice,
        sellingPrice: dto.sellingPrice,
        quantityOnHand: dto.quantityOnHand,
        rackLocation: dto.rackLocation || null,
        status: BatchStatus.ACTIVE
      }
    });

    if (dto.quantityOnHand > 0 && userId) {
      try {
        await this.prisma.stockMovement.create({
          data: {
            batchId: batch.id,
            movementType: MovementType.PURCHASE,
            quantityDelta: dto.quantityOnHand,
            balanceAfter: dto.quantityOnHand,
            referenceType: 'INITIAL_STOCK',
            referenceId: batch.id,
            userId: BigInt(userId),
            note: 'Initial batch opening stock'
          }
        });
      } catch (e) {
        // Log movement error non-blocking
      }
    }

    return batch;
  }

  async update(
    id: string,
    data: {
      sellingPrice?: number;
      costPrice?: number;
      wholesalePrice?: number;
      quantityOnHand?: number;
      status?: BatchStatus;
      rackLocation?: string;
      warehouseLocation?: string;
      storageCondition?: string;
      reorderLevel?: number;
      batchNumber?: string;
      mfgDate?: string | Date;
      expiryDate?: string | Date;
      reason?: string;
    },
    userId?: string
  ) {
    const batch = await this.prisma.medicineBatch.findUnique({
      where: { id: BigInt(id) },
      include: { medicine: true }
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const batchUpdates: any = {};
    if (data.sellingPrice !== undefined) batchUpdates.sellingPrice = data.sellingPrice;
    if (data.costPrice !== undefined) batchUpdates.costPrice = data.costPrice;
    if (data.status) batchUpdates.status = data.status;
    if (data.rackLocation !== undefined) batchUpdates.rackLocation = data.rackLocation;
    if (data.batchNumber !== undefined && data.batchNumber.trim() !== '') {
      batchUpdates.batchNumber = data.batchNumber.trim().toUpperCase();
    }
    if (data.mfgDate !== undefined) {
      batchUpdates.mfgDate = data.mfgDate ? new Date(data.mfgDate) : null;
    }
    if (data.expiryDate !== undefined && data.expiryDate) {
      batchUpdates.expiryDate = new Date(data.expiryDate);
    }

    let qtyDelta = 0;
    if (data.quantityOnHand !== undefined) {
      const oldQty = Number(batch.quantityOnHand);
      const newQty = Number(data.quantityOnHand);
      qtyDelta = newQty - oldQty;
      batchUpdates.quantityOnHand = newQty;
    }

    return await this.prisma.$transaction(async (tx) => {
      const updatedBatch = await tx.medicineBatch.update({
        where: { id: batch.id },
        data: batchUpdates,
        include: {
          medicine: {
            select: {
              id: true,
              name: true,
              brandName: true,
              strength: true,
              skuCode: true,
              barcode: true,
              dosageForm: true,
              wholesalePrice: true,
              purchasePrice: true,
              sellingPrice: true,
              reorderLevel: true,
              maxStockLevel: true,
              rackLocation: true,
              warehouseLocation: true,
              storageCondition: true
            }
          }
        }
      });

      // Update medicine storage/commercial details if provided
      const medUpdates: any = {};
      if (data.warehouseLocation !== undefined) medUpdates.warehouseLocation = data.warehouseLocation;
      if (data.storageCondition !== undefined) medUpdates.storageCondition = data.storageCondition;
      if (data.wholesalePrice !== undefined) medUpdates.wholesalePrice = data.wholesalePrice;
      if (data.reorderLevel !== undefined) medUpdates.reorderLevel = data.reorderLevel;
      if (data.rackLocation !== undefined && !batch.medicine.rackLocation) {
        medUpdates.rackLocation = data.rackLocation;
      }

      if (Object.keys(medUpdates).length > 0) {
        await tx.medicine.update({
          where: { id: batch.medicineId },
          data: medUpdates
        });
      }

      // Record Stock Movement if quantity changed
      if (qtyDelta !== 0) {
        const movementType = qtyDelta > 0 ? MovementType.PURCHASE : MovementType.PHYSICAL_COUNT_VARIANCE;
        try {
          await tx.stockMovement.create({
            data: {
              batchId: batch.id,
              movementType,
              quantityDelta: qtyDelta,
              balanceAfter: Number(data.quantityOnHand),
              referenceType: 'MANUAL_STOCK_UPDATE',
              referenceId: batch.id,
              userId: userId ? BigInt(userId) : null,
              note: data.reason || `Direct stock update (${qtyDelta > 0 ? '+' : ''}${qtyDelta} units)`
            }
          });
        } catch (e) {
          // Log movement error non-blocking
        }
      }

      return updatedBatch;
    });
  }

  async transferLocation(id: string, newLocation: string, userId?: string) {
    const batch = await this.prisma.medicineBatch.findUnique({
      where: { id: BigInt(id) }
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const previousLocation = batch.rackLocation || 'Unassigned';

    const updated = await this.prisma.medicineBatch.update({
      where: { id: batch.id },
      data: { rackLocation: newLocation }
    });

    if (userId) {
      try {
        await this.prisma.stockMovement.create({
          data: {
            batchId: batch.id,
            movementType: MovementType.PHYSICAL_COUNT_VARIANCE,
            quantityDelta: 0,
            balanceAfter: batch.quantityOnHand,
            referenceType: 'LOCATION_TRANSFER',
            referenceId: batch.id,
            userId: BigInt(userId),
            note: `Location relocated from "${previousLocation}" to "${newLocation}"`
          }
        });
      } catch (e) {
        // ignore
      }
    }

    return updated;
  }

  async returnToSupplier(batchId: string, quantity: number, reason: string, userId?: string) {
    const batch = await this.prisma.medicineBatch.findUnique({
      where: { id: BigInt(batchId) }
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const currentQty = Number(batch.quantityOnHand);
    if (quantity <= 0 || quantity > currentQty) {
      throw new BadRequestException(`Invalid return quantity. Maximum returnable: ${currentQty}`);
    }

    const newQty = currentQty - quantity;

    return await this.prisma.$transaction(async (tx) => {
      const updatedBatch = await tx.medicineBatch.update({
        where: { id: batch.id },
        data: { quantityOnHand: newQty }
      });

      if (userId) {
        await tx.stockMovement.create({
          data: {
            batchId: batch.id,
            movementType: MovementType.PURCHASE_RETURN,
            quantityDelta: -quantity,
            balanceAfter: newQty,
            referenceType: 'SUPPLIER_RETURN',
            referenceId: batch.id,
            userId: BigInt(userId),
            note: `Supplier Return: ${reason || 'Damaged / Expired / Recalled'}`
          }
        });
      }

      return updatedBatch;
    });
  }
}
