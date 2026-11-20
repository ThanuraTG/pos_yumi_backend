import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-po.dto';
import { ReceiveGoodsDto } from './dto/receive-grn.dto';
import { PurchaseStatus, MovementType, BatchStatus, SupplierPayMethod } from '@prisma/client';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async createPurchaseOrder(userId: string, dto: CreatePurchaseOrderDto) {
    const userBigInt = BigInt(userId);
    const supplierBigInt = BigInt(dto.supplierId);

    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierBigInt }
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    let subtotal = 0;
    const poItems = [];

    for (const item of dto.items) {
      const qty = Number(item.orderedQuantity ?? item.quantity ?? 1);
      const unitCost = Number(item.estimatedUnitCost ?? item.unitCost ?? 0);
      const lineTotal = qty * unitCost;
      subtotal += lineTotal;
      poItems.push({
        medicineId: BigInt(item.medicineId),
        batchNumber: 'PENDING',
        expiryDate: new Date('2099-12-31'),
        orderedQuantity: qty,
        unitCost: unitCost,
        sellingPrice: 0,
        lineTotal
      });
    }

    const poPrefix = process.env.PO_PREFIX || 'PO';
    const poNumber = `${poPrefix}-${Date.now()}`;
    return await this.prisma.purchase.create({
      data: {
        purchaseNumber: poNumber,
        supplierId: supplierBigInt,
        status: PurchaseStatus.ORDERED,
        subtotal,
        totalAmount: subtotal,
        createdBy: userBigInt,
        items: {
          create: poItems
        }
      },
      include: {
        items: {
          include: { medicine: { select: { id: true, name: true, brandName: true, strength: true, dosageForm: true } } }
        },
        supplier: true
      }
    });
  }

  async approvePO(id: string, userId: string) {
    const po = await this.prisma.purchase.findUnique({ where: { id: BigInt(id) } });
    if (!po) throw new NotFoundException('Purchase Order not found');

    return await this.prisma.purchase.update({
      where: { id: po.id },
      data: { status: PurchaseStatus.ORDERED }
    });
  }

  async cancelPO(id: string, userId: string) {
    const po = await this.prisma.purchase.findUnique({ where: { id: BigInt(id) } });
    if (!po) throw new NotFoundException('Purchase Order not found');

    return await this.prisma.purchase.update({
      where: { id: po.id },
      data: { status: PurchaseStatus.CANCELLED }
    });
  }

  async receiveGoods(userId: string, dto: ReceiveGoodsDto) {
    const userBigInt = BigInt(userId);
    const supplierBigInt = BigInt(dto.supplierId);

    return await this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({
        where: { id: supplierBigInt }
      });
      if (!supplier) throw new NotFoundException('Supplier not found');

      let invoiceSubtotal = 0;
      const grnItems = [];

      for (const item of dto.items) {
        const expiry = new Date(item.expiryDate);
        const sixMonthsAhead = new Date();
        sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);

        if (expiry <= new Date()) {
          throw new BadRequestException(
            `Cannot receive already expired stock: Batch ${item.batchNumber}`
          );
        }

        const billedQty = Number(item.receivedQuantity ?? item.quantity ?? 1);
        const bonusQty = Number(item.bonusQuantity || 0);
        const totalReceivedQty = billedQty + bonusQty;

        // Weighted Average Landed Cost Calculation
        const effectiveUnitCost = totalReceivedQty > 0 ? (billedQty * item.unitCost) / totalReceivedQty : item.unitCost;
        const lineTotal = billedQty * item.unitCost;
        invoiceSubtotal += lineTotal;

        // Create or update batch
        const batch = await tx.medicineBatch.upsert({
          where: {
            uk_medicine_batch: {
              medicineId: BigInt(item.medicineId),
              batchNumber: item.batchNumber
            }
          },
          update: {
            quantityOnHand: { increment: totalReceivedQty },
            costPrice: effectiveUnitCost,
            sellingPrice: item.sellingPrice,
            expiryDate: expiry,
            status: BatchStatus.ACTIVE
          },
          create: {
            medicineId: BigInt(item.medicineId),
            batchNumber: item.batchNumber,
            expiryDate: expiry,
            costPrice: effectiveUnitCost,
            sellingPrice: item.sellingPrice,
            quantityOnHand: totalReceivedQty,
            status: BatchStatus.ACTIVE
          }
        });

        grnItems.push({
          medicineId: BigInt(item.medicineId),
          batchId: batch.id,
          batchNumber: item.batchNumber,
          expiryDate: expiry,
          orderedQuantity: billedQty,
          receivedQuantity: billedQty,
          bonusQuantity: bonusQty,
          unitCost: effectiveUnitCost,
          sellingPrice: item.sellingPrice,
          lineTotal
        });

        // Append to Immutable Stock Movement Ledger
        await tx.stockMovement.create({
          data: {
            batchId: batch.id,
            movementType: MovementType.PURCHASE,
            quantityDelta: totalReceivedQty,
            balanceAfter: batch.quantityOnHand,
            referenceType: 'GRN_PURCHASE',
            referenceId: BigInt(0),
            userId: userBigInt,
            note: `GRN Received: ${billedQty} billed + ${bonusQty} bonus units`
          }
        });
      }

      const discount = Number(dto.discountAmount || 0);
      const tax = Number(dto.taxAmount || 0);
      const totalAmount = invoiceSubtotal - discount + tax;
      const amountPaid = Number(dto.amountPaid || 0);

      const grnPrefix = process.env.GRN_PREFIX || 'GRN';
      const invPrefix = process.env.INVOICE_PREFIX || 'INV';
      const purchaseNumber = `${grnPrefix}-${Date.now()}`;
      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: supplierBigInt,
          supplierInvoiceNo: dto.supplierInvoiceNo || dto.invoiceReference || `${invPrefix}-${Date.now()}`,
          status: PurchaseStatus.RECEIVED,
          subtotal: invoiceSubtotal,
          discountAmount: discount,
          taxAmount: tax,
          totalAmount: totalAmount,
          amountPaid: amountPaid,
          createdBy: userBigInt,
          receivedAt: new Date(),
          items: {
            create: grnItems
          }
        },
        include: {
          items: {
            include: { medicine: true, batch: true }
          },
          supplier: true
        }
      });

      // If initial payment was made during intake
      if (amountPaid > 0) {
        const payMethod = (dto.paymentMethod as SupplierPayMethod) || SupplierPayMethod.BANK_TRANSFER;
        await tx.supplierPayment.create({
          data: {
            paymentNumber: `SP-${Date.now()}`,
            supplierId: supplierBigInt,
            purchaseId: purchase.id,
            amount: amountPaid,
            paymentMethod: payMethod,
            paymentReference: dto.paymentReference || 'GRN Initial Payment',
            createdBy: userBigInt
          }
        });
      }

      // If purchase linked to a prior Purchase Order, mark PO as RECEIVED
      if (dto.purchaseOrderId) {
        try {
          await tx.purchase.update({
            where: { id: BigInt(dto.purchaseOrderId) },
            data: { status: PurchaseStatus.RECEIVED }
          });
        } catch (e) {
          // ignore
        }
      }

      // Update supplier outstanding balance (Net trade payable: totalAmount - amountPaid)
      const netPayable = totalAmount - amountPaid;
      if (netPayable !== 0) {
        await tx.supplier.update({
          where: { id: supplierBigInt },
          data: {
            currentBalance: { increment: netPayable }
          }
        });
      }

      return purchase;
    });
  }

  async recordPayment(
    purchaseId: string,
    userId: string,
    data: { amount: number; paymentMethod: SupplierPayMethod; paymentReference?: string }
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: BigInt(purchaseId) },
      include: { supplier: true }
    });
    if (!purchase) throw new NotFoundException('Purchase record not found');

    const paymentAmount = Number(data.amount);
    if (paymentAmount <= 0) throw new BadRequestException('Payment amount must be greater than 0');

    return await this.prisma.$transaction(async (tx) => {
      const paymentNumber = `SP-${Date.now()}`;

      // Create SupplierPayment linked to purchase
      const payment = await tx.supplierPayment.create({
        data: {
          paymentNumber,
          supplierId: purchase.supplierId,
          purchaseId: purchase.id,
          amount: paymentAmount,
          paymentMethod: data.paymentMethod || SupplierPayMethod.BANK_TRANSFER,
          paymentReference: data.paymentReference || 'Purchase Invoice Settlement',
          createdBy: BigInt(userId)
        }
      });

      // Increment amountPaid on Purchase
      const updatedPurchase = await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          amountPaid: { increment: paymentAmount }
        }
      });

      // Deduct from supplier currentBalance
      await tx.supplier.update({
        where: { id: purchase.supplierId },
        data: {
          currentBalance: { decrement: paymentAmount }
        }
      });

      return { payment, purchase: updatedPurchase };
    });
  }

  async createReturn(
    userId: string,
    data: {
      supplierId: string;
      purchaseId?: string;
      items: Array<{ batchId: string; quantity: number; unitCost: number; reason?: string }>;
      notes?: string;
    }
  ) {
    const supplierBigInt = BigInt(data.supplierId);
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierBigInt } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    return await this.prisma.$transaction(async (tx) => {
      let returnTotal = 0;
      const returnItemsToCreate = [];

      for (const item of data.items) {
        const batch = await tx.medicineBatch.findUnique({ where: { id: BigInt(item.batchId) } });
        if (!batch) throw new NotFoundException(`Batch ID ${item.batchId} not found`);

        const lineTotal = item.quantity * item.unitCost;
        returnTotal += lineTotal;

        // Deduct from batch
        const updatedBatch = await tx.medicineBatch.update({
          where: { id: batch.id },
          data: {
            quantityOnHand: { decrement: item.quantity }
          }
        });

        returnItemsToCreate.push({
          batchId: batch.id,
          returnQuantity: item.quantity,
          unitCost: item.unitCost,
          lineTotal: lineTotal
        });

        // Stock movement ledger
        await tx.stockMovement.create({
          data: {
            batchId: batch.id,
            movementType: MovementType.PURCHASE_RETURN,
            quantityDelta: -item.quantity,
            balanceAfter: updatedBatch.quantityOnHand,
            referenceType: 'PURCHASE_RETURN',
            referenceId: BigInt(0),
            userId: BigInt(userId),
            note: `Supplier Return: ${item.reason || data.notes || 'Damaged/Defective lot'}`
          }
        });
      }

      const prPrefix = process.env.PURCHASE_RETURN_PREFIX || 'PR';
      const returnNumber = `${prPrefix}-${Date.now()}`;
      const pReturn = await tx.purchaseReturn.create({
        data: {
          returnNumber,
          supplierId: supplierBigInt,
          totalAmount: returnTotal,
          notes: data.notes || null,
          items: {
            create: returnItemsToCreate
          }
        },
        include: { items: true }
      });

      // Deduct from supplier trade balance
      await tx.supplier.update({
        where: { id: supplierBigInt },
        data: {
          currentBalance: { decrement: returnTotal }
        }
      });

      return pReturn;
    });
  }

  async findAllReturns() {
    return await this.prisma.purchaseReturn.findMany({
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findAll(page = 1, limit = 20, status?: PurchaseStatus) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        include: {
          supplier: { select: { id: true, name: true, phone: true, paymentTerms: true } },
          creator: { select: { fullName: true } },
          items: {
            include: {
              medicine: { select: { id: true, name: true, brandName: true, strength: true, dosageForm: true } }
            }
          },
          payments: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.purchase.count({ where })
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }
}

