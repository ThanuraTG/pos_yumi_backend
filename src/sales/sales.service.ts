import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateSalesReturnDto } from './dto/sales-return.dto';
import { SyncOfflineSalesDto } from './dto/sync-offline.dto';
import { SaleStatus, MovementType, RestockStatus, Prisma } from '@prisma/client';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async checkout(userId: string, dto: CreateSaleDto) {
    const userBigInt = BigInt(userId);

    return await this.prisma.$transaction(
      async (tx) => {
        // 1. Idempotency Check (Prevents double charging on network disconnects)
        const existingSale = await tx.sale.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: { items: true, payments: true }
        });
        if (existingSale) {
          return existingSale;
        }

        // 2. Assert Cashier has an active open cash drawer session (or auto-open if offline sync)
        let activeSession = await tx.cashSession.findFirst({
          where: { userId: userBigInt, status: 'OPEN' }
        });
        if (!activeSession) {
          if (dto.isOfflineSync) {
            activeSession = await tx.cashSession.create({
              data: {
                userId: userBigInt,
                openingFloat: new Prisma.Decimal(0),
                status: 'OPEN',
                notes: 'Auto-created session for offline POS sync'
              }
            });
          } else {
            throw new BadRequestException('Cashier has no active open cash session. Please open register float first.');
          }
        }

        let computedSubtotal = 0;
        const saleItemsToInsert = [];

        // 3. Process each line item with atomic stock validation
        for (const item of dto.items) {
          const batch = await tx.medicineBatch.findUnique({
            where: { id: BigInt(item.batchId) },
            include: { medicine: true }
          });

          if (!batch) {
            throw new NotFoundException(`Batch ID ${item.batchId} not found.`);
          }

          // Strict Expiry Lockout (Skip during offline sync if already physically dispensed)
          if (!dto.isOfflineSync && new Date(batch.expiryDate) <= new Date()) {
            throw new BadRequestException(
              `Batch ${batch.batchNumber} for ${batch.medicine.name} has EXPIRED. Dispensing blocked.`
            );
          }

          // Concurrency & Stock Check
          if (Number(batch.quantityOnHand) < item.quantity && !dto.isOfflineSync) {
            throw new ConflictException(
              `Insufficient stock in Batch ${batch.batchNumber}. Available: ${batch.quantityOnHand}, Requested: ${item.quantity}`
            );
          }

          // Atomic Decrement
          const updatedBatch = await tx.medicineBatch.update({
            where: { id: batch.id },
            data: {
              quantityOnHand: { decrement: item.quantity }
            }
          });

          const lineTotal =
            item.quantity * Number(item.unitPrice) -
            Number(item.discountAmount || 0);
          computedSubtotal += lineTotal;

          saleItemsToInsert.push({
            medicineId: batch.medicineId,
            batchId: batch.id,
            unitId: item.unitId ? BigInt(item.unitId) : null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitCostSnapshot: batch.costPrice, // Lock historical landed cost
            discountAmount: item.discountAmount || 0,
            lineTotal: lineTotal
          });

          // Append to Immutable Stock Movement Ledger
          await tx.stockMovement.create({
            data: {
              batchId: batch.id,
              movementType: MovementType.SALE,
              quantityDelta: -item.quantity,
              balanceAfter: updatedBatch.quantityOnHand,
              referenceType: 'SALE_INVOICE',
              referenceId: BigInt(0), // Placeholder, updated post sale creation
              userId: userBigInt,
              note: dto.isOfflineSync
                ? `POS Dispensed (Offline Sync): ${item.quantity} units (Conducted at ${dto.offlineCreatedAt || 'offline'})`
                : `POS Dispensed: ${item.quantity} units`
            }
          });
        }

        const grandTotal =
          computedSubtotal -
          Number(dto.discountAmount || 0) +
          Number(dto.taxAmount || 0);

        // Validate tender
        const totalPaid = dto.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const currency = process.env.DEFAULT_CURRENCY || 'LKR';
        if (totalPaid < grandTotal) {
          throw new BadRequestException(
            `Total payments (${currency} ${totalPaid.toFixed(2)}) cannot be less than Grand Total (${currency} ${grandTotal.toFixed(2)})`
          );
        }

        const changeAmount = totalPaid - grandTotal;

        // Generate or preserve unique invoice number
        let invoiceNumber = dto.invoiceNumber;
        if (invoiceNumber) {
          const existingInv = await tx.sale.findUnique({
            where: { invoiceNumber }
          });
          if (existingInv) {
            if (existingInv.idempotencyKey === dto.idempotencyKey) {
              return existingInv;
            }
            invoiceNumber = `${invoiceNumber}-${Math.floor(100 + Math.random() * 900)}`;
          }
        } else {
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const randomStr = Math.floor(1000 + Math.random() * 9000);
          const invoicePrefix = process.env.INVOICE_PREFIX || 'INV';
          invoiceNumber = `${invoicePrefix}-${dateStr}-${randomStr}`;
        }

        const saleDate = dto.offlineCreatedAt ? new Date(dto.offlineCreatedAt) : new Date();

        // Create Sale Record
        const sale = await tx.sale.create({
          data: {
            invoiceNumber,
            idempotencyKey: dto.idempotencyKey,
            cashSessionId: activeSession.id,
            customerId: dto.customerId ? BigInt(dto.customerId) : null,
            prescriptionId: dto.prescriptionId ? BigInt(dto.prescriptionId) : null,
            cashierId: userBigInt,
            status: SaleStatus.COMPLETED,
            subtotal: computedSubtotal,
            discountAmount: dto.discountAmount || 0,
            taxAmount: dto.taxAmount || 0,
            grandTotal: grandTotal,
            amountPaid: dto.amountPaid,
            changeAmount: changeAmount,
            createdAt: saleDate,
            items: {
              create: saleItemsToInsert
            },
            payments: {
              create: dto.payments.map((p) => ({
                paymentMethod: p.method,
                amount: p.amount,
                referenceCode: p.referenceCode || null,
                status: 'SUCCESS'
              }))
            }
          },
          include: {
            items: {
              include: { medicine: true, batch: true }
            },
            payments: true,
            customer: true,
            cashier: {
              select: { id: true, fullName: true, username: true }
            }
          }
        });

        // Update prescription dispensed refills if linked
        if (dto.prescriptionId) {
          await tx.prescription.update({
            where: { id: BigInt(dto.prescriptionId) },
            data: {
              dispensedRefills: { increment: 1 },
              status: 'DISPENSED'
            }
          });
        }

        return sale;
      },
      {
        isolationLevel: 'ReadCommitted',
        maxWait: 5000,
        timeout: 10000
      }
    );
  }

  /**
   * Synchronize batch of offline sales conducted without network connection
   */
  async syncOfflineSales(userId: string, dto: SyncOfflineSalesDto) {
    const results = [];
    let syncedCount = 0;
    let failedCount = 0;

    for (const saleDto of dto.sales) {
      try {
        saleDto.isOfflineSync = true;
        const sale = await this.checkout(userId, saleDto);
        results.push({
          idempotencyKey: saleDto.idempotencyKey,
          invoiceNumber: sale.invoiceNumber,
          success: true,
          sale
        });
        syncedCount++;
      } catch (err: any) {
        results.push({
          idempotencyKey: saleDto.idempotencyKey,
          invoiceNumber: saleDto.invoiceNumber || 'UNKNOWN',
          success: false,
          error: err.message || 'Offline sync failed'
        });
        failedCount++;
      }
    }

    return {
      total: dto.sales.length,
      synced: syncedCount,
      failed: failedCount,
      results
    };
  }

  async processReturn(userId: string, dto: CreateSalesReturnDto) {
    const userBigInt = BigInt(userId);

    return await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: BigInt(dto.saleId) },
        include: { items: true }
      });
      if (!sale) throw new NotFoundException('Sale invoice not found');

      let refundTotal = 0;
      const returnItemsData = [];

      for (const item of dto.items) {
        const saleItem = sale.items.find((si) => si.id === BigInt(item.saleItemId));
        if (!saleItem) throw new BadRequestException(`Item ${item.saleItemId} not found on invoice`);

        if (Number(saleItem.quantity) < item.returnQuantity) {
          throw new BadRequestException(
            `Return quantity (${item.returnQuantity}) exceeds original sold quantity (${saleItem.quantity})`
          );
        }

        const refundLine = item.returnQuantity * Number(saleItem.unitPrice);
        refundTotal += refundLine;

        returnItemsData.push({
          saleItemId: saleItem.id,
          batchId: saleItem.batchId,
          returnQuantity: item.returnQuantity,
          refundAmount: refundLine,
          restockStatus: item.restockStatus
        });

        // If condition is RESTOCKED, return units to batch
        if (item.restockStatus === RestockStatus.RESTOCKED) {
          const updatedBatch = await tx.medicineBatch.update({
            where: { id: saleItem.batchId },
            data: { quantityOnHand: { increment: item.returnQuantity } }
          });

          await tx.stockMovement.create({
            data: {
              batchId: saleItem.batchId,
              movementType: MovementType.SALE_RETURN,
              quantityDelta: item.returnQuantity,
              balanceAfter: updatedBatch.quantityOnHand,
              referenceType: 'SALE_RETURN',
              referenceId: sale.id,
              userId: userBigInt,
              note: `Restocked customer return`
            }
          });
        }
      }

      const returnPrefix = process.env.SALES_RETURN_PREFIX || 'RET';
      const returnNumber = `${returnPrefix}-${Date.now()}`;
      const salesReturn = await tx.salesReturn.create({
        data: {
          returnNumber,
          saleId: sale.id,
          reason: dto.reason,
          refundTotal,
          refundMethod: dto.refundMethod,
          processedBy: userBigInt,
          approvedBy: userBigInt,
          returnItems: {
            create: returnItemsData
          }
        },
        include: { returnItems: true }
      });

      // Update sale status
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: SaleStatus.REFUNDED }
      });

      return salesReturn;
    });
  }

  async findAll(page = 1, limit = 20, cashierId?: string, status?: SaleStatus, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (cashierId) where.cashierId = BigInt(cashierId);
    if (status) where.status = status;
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { invoiceNumber: { contains: q } },
        { customer: { name: { contains: q } } },
        { customer: { phone: { contains: q } } }
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip,
        take: limit,
        include: {
          cashier: { select: { fullName: true, username: true } },
          customer: { select: { name: true, phone: true } },
          items: {
            include: { medicine: true, batch: true }
          },
          payments: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.sale.count({ where })
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: BigInt(id) },
      include: {
        cashier: { select: { fullName: true, username: true } },
        customer: true,
        items: {
          include: { medicine: true, batch: true, unit: true }
        },
        payments: true,
        salesReturns: {
          include: { returnItems: true }
        }
      }
    });
    if (!sale) throw new NotFoundException('Sale invoice not found');
    return sale;
  }

  async logReprint(id: string) {
    return await this.prisma.sale.update({
      where: { id: BigInt(id) },
      data: { reprintCount: { increment: 1 } }
    });
  }

  async voidSale(saleId: string, userId: string, reason?: string) {
    const userBigInt = BigInt(userId);
    const saleBigInt = BigInt(saleId);

    return await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleBigInt },
        include: { items: true }
      });

      if (!sale) throw new NotFoundException(`Sale ${saleId} not found`);
      if (sale.status === SaleStatus.VOIDED) {
        throw new BadRequestException('This sale invoice is already voided');
      }

      // Restock all batches and append movement ledger
      for (const item of sale.items) {
        const updatedBatch = await tx.medicineBatch.update({
          where: { id: item.batchId },
          data: {
            quantityOnHand: { increment: item.quantity }
          }
        });

        await tx.stockMovement.create({
          data: {
            batchId: item.batchId,
            movementType: MovementType.SALE_RETURN,
            quantityDelta: item.quantity,
            balanceAfter: updatedBatch.quantityOnHand,
            referenceType: 'SALE_VOID',
            referenceId: sale.id,
            userId: userBigInt,
            note: `Sale #${sale.invoiceNumber} VOIDED: ${reason || 'Cashier cancellation'}`
          }
        });
      }

      return await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: SaleStatus.VOIDED
        },
        include: { items: true, payments: true }
      });
    });
  }

  async getPayments(saleId: string) {
    return await this.prisma.payment.findMany({
      where: { saleId: BigInt(saleId) },
      orderBy: { createdAt: 'desc' }
    });
  }

  async recordPayment(saleId: string, method: any, amount: number, referenceCode?: string) {
    return await this.prisma.payment.create({
      data: {
        saleId: BigInt(saleId),
        paymentMethod: method,
        amount: new Prisma.Decimal(amount),
        referenceCode: referenceCode || null
      }
    });
  }

  async getReturns() {
    return await this.prisma.salesReturn.findMany({
      include: {
        sale: { select: { id: true, invoiceNumber: true, createdAt: true } },
        processor: { select: { id: true, fullName: true, username: true } },
        approver: { select: { id: true, fullName: true, username: true } },
        returnItems: {
          include: {
            batch: { include: { medicine: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}

