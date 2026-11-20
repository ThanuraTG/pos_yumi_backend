import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { BatchStatus, DosageForm, MovementType, Prisma } from '@prisma/client';

/**
 * Normalize any input string or master dosage form name into a valid Prisma DosageForm enum
 */
export function normalizeDosageForm(input?: string): DosageForm {
  if (!input) return DosageForm.OTHER;
  const upper = input.toUpperCase().trim();

  // 1. Direct Prisma DosageForm Enum match
  if (Object.values(DosageForm).includes(upper as DosageForm)) {
    return upper as DosageForm;
  }

  // 2. Clinical and master form keyword mappings
  if (upper.includes('TAB')) return DosageForm.TABLET;
  if (upper.includes('CAP')) return DosageForm.CAPSULE;
  if (upper.includes('SYR') || upper.includes('ELIXIR') || upper.includes('LIQUID')) return DosageForm.SYRUP;
  if (upper.includes('SUSP') || upper.includes('EMULSION')) return DosageForm.SUSPENSION;
  if (upper.includes('INJ') || upper.includes('INFUS') || upper.includes('SYRING') || upper.includes('IV') || upper.includes('IM')) return DosageForm.INJECTION;
  if (upper.includes('CREAM') || upper.includes('LOTION')) return DosageForm.CREAM;
  if (upper.includes('OINT') || upper.includes('GEL') || upper.includes('PASTE') || upper.includes('JELLY')) return DosageForm.OINTMENT;
  if (upper.includes('DROP')) return DosageForm.DROPS;
  if (upper.includes('INHAL') || upper.includes('AEROSOL') || upper.includes('SPRAY') || upper.includes('NASAL') || upper.includes('NEBUL')) return DosageForm.INHALER;

  return DosageForm.OTHER;
}

@Injectable()
export class MedicinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  /**
   * Automatically generate a unique, clean Medicine Code (SKU)
   * Format: MED-YYYYMM-XXXX
   */
  async generateSkuCode(): Promise<string> {
    const skuPrefix = process.env.SKU_PREFIX || 'MED';
    const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
    const prefix = `${skuPrefix}-${datePrefix}`;

    // Find the latest code with this prefix
    const latest = await this.prisma.medicine.findFirst({
      where: { skuCode: { startsWith: prefix } },
      orderBy: { skuCode: 'desc' },
      select: { skuCode: true }
    });

    let sequence = 1;
    if (latest && latest.skuCode) {
      const parts = latest.skuCode.split('-');
      if (parts.length === 3) {
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) sequence = lastSeq + 1;
      }
    }

    const padSeq = String(sequence).padStart(4, '0');
    return `${prefix}-${padSeq}`;
  }

  async findAll(
    page = 1,
    limit = 20,
    search?: string,
    categoryId?: string,
    brandName?: string,
    manufacturerId?: string,
    stockStatus?: string,
    expiryStatus?: string,
    isActive?: string,
    sortBy = 'brandName',
    sortOrder: 'asc' | 'desc' = 'asc',
    dosageForm?: string,
    prescriptionType?: string
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.MedicineWhereInput = { deletedAt: null };

    if (isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { brandName: { contains: q } },
        { skuCode: { contains: q } },
        { barcode: { contains: q } },
        { generic: { name: { contains: q } } },
        { manufacturer: { name: { contains: q } } }
      ];
    }

    if (categoryId) {
      where.categoryId = BigInt(categoryId);
    }

    if (brandName) {
      where.brandName = { contains: brandName };
    }

    if (manufacturerId) {
      where.manufacturerId = BigInt(manufacturerId);
    }

    if (dosageForm) {
      where.dosageForm = normalizeDosageForm(dosageForm);
    }

    if (prescriptionType === 'RX') {
      where.prescriptionRequired = true;
    } else if (prescriptionType === 'OTC') {
      where.prescriptionRequired = false;
      where.isNarcotic = false;
    } else if (prescriptionType === 'NARCOTIC') {
      where.isNarcotic = true;
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const [rawItems, total] = await Promise.all([
      this.prisma.medicine.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: true,
          subCategoryRef: true,
          dosageFormRef: true,
          packaging: true,
          manufacturer: true,
          generic: true,
          supplier: {
            select: { id: true, name: true, code: true, phone: true }
          },
          units: true,
          batches: {
            select: {
              id: true,
              batchNumber: true,
              expiryDate: true,
              mfgDate: true,
              costPrice: true,
              sellingPrice: true,
              quantityOnHand: true,
              status: true,
              rackLocation: true
            },
            orderBy: { expiryDate: 'asc' } // FEFO order
          }
        },
        orderBy: { [sortBy]: sortOrder }
      }),
      this.prisma.medicine.count({ where })
    ]);

    // Enhance records with calculated inventory metrics
    const enhancedItems = rawItems.map((med) => {
      const activeBatches = med.batches.filter((b) => b.status === BatchStatus.ACTIVE);
      const validBatches = activeBatches.filter((b) => new Date(b.expiryDate) > now);

      const availableStock = validBatches.reduce(
        (sum, b) => sum + Number(b.quantityOnHand),
        0
      );
      const totalStock = med.batches.reduce(
        (sum, b) => sum + Number(b.quantityOnHand),
        0
      );

      // Nearest active expiry date
      const nearestExpiry = validBatches.length > 0 ? validBatches[0].expiryDate : null;

      // Has expired lots?
      const hasExpired = med.batches.some(
        (b) => b.status === BatchStatus.EXPIRED || new Date(b.expiryDate) <= now
      );
      // Has lots expiring within 30 days?
      const hasNearExpiry = validBatches.some(
        (b) => new Date(b.expiryDate) <= thirtyDaysFromNow
      );

      let calculatedStockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
      if (availableStock <= 0) {
        calculatedStockStatus = 'OUT_OF_STOCK';
      } else if (availableStock <= Number(med.reorderLevel)) {
        calculatedStockStatus = 'LOW_STOCK';
      }

      let calculatedExpiryStatus: 'VALID' | 'NEAR_EXPIRY' | 'EXPIRED' = 'VALID';
      if (hasExpired) {
        calculatedExpiryStatus = 'EXPIRED';
      } else if (hasNearExpiry) {
        calculatedExpiryStatus = 'NEAR_EXPIRY';
      }

      // Default or latest price snapshots
      const latestBatch = med.batches[med.batches.length - 1];
      const purchasePrice = med.purchasePrice
        ? Number(med.purchasePrice)
        : latestBatch
        ? Number(latestBatch.costPrice)
        : 0;
      const sellingPrice = med.sellingPrice
        ? Number(med.sellingPrice)
        : latestBatch
        ? Number(latestBatch.sellingPrice)
        : 0;

      const profitAmount = Math.max(0, sellingPrice - purchasePrice);
      const profitMargin =
        sellingPrice > 0 ? ((profitAmount / sellingPrice) * 100).toFixed(2) : '0.00';

      return {
        ...med,
        availableStock,
        totalStock,
        nearestExpiryDate: nearestExpiry,
        stockStatus: calculatedStockStatus,
        expiryStatus: calculatedExpiryStatus,
        effectivePurchasePrice: purchasePrice,
        effectiveSellingPrice: sellingPrice,
        profitAmount,
        profitMargin: parseFloat(profitMargin),
        batchesCount: med.batches.length
      };
    });

    // Client-side filtering on computed statuses if requested
    let filteredItems = enhancedItems;
    if (stockStatus) {
      filteredItems = filteredItems.filter((m) => m.stockStatus === stockStatus);
    }
    if (expiryStatus) {
      filteredItems = filteredItems.filter((m) => m.expiryStatus === expiryStatus);
    }

    return {
      items: filteredItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async searchForPos(query: string) {
    if (!query || query.trim().length === 0) return [];
    const cleanQuery = query.trim();

    // 1. Direct barcode match (EAN / Unit Barcode)
    const barcodeMatch = await this.prisma.medicine.findFirst({
      where: {
        OR: [
          { barcode: cleanQuery },
          { units: { some: { barcode: cleanQuery } } }
        ],
        isActive: true,
        deletedAt: null
      },
      include: {
        units: true,
        generic: true,
        batches: {
          where: {
            status: BatchStatus.ACTIVE,
            quantityOnHand: { gt: 0 },
            expiryDate: { gt: new Date() }
          },
          orderBy: { expiryDate: 'asc' } // FEFO order
        }
      }
    });

    if (barcodeMatch) return [barcodeMatch];

    // 2. Multi-field search (Brand, Generic, SKU, Strength)
    return await this.prisma.medicine.findMany({
      where: {
        OR: [
          { brandName: { contains: cleanQuery } },
          { name: { contains: cleanQuery } },
          { generic: { name: { contains: cleanQuery } } },
          { skuCode: { contains: cleanQuery } }
        ],
        isActive: true,
        deletedAt: null
      },
      take: 20,
      include: {
        units: true,
        generic: true,
        batches: {
          where: {
            status: BatchStatus.ACTIVE,
            quantityOnHand: { gt: 0 },
            expiryDate: { gt: new Date() }
          },
          orderBy: { expiryDate: 'asc' } // FEFO order
        }
      },
      orderBy: { brandName: 'asc' }
    });
  }

  async findOne(id: string) {
    const medicine = await this.prisma.medicine.findUnique({
      where: { id: BigInt(id) },
      include: {
        category: true,
        subCategoryRef: true,
        dosageFormRef: true,
        packaging: true,
        manufacturer: true,
        generic: true,
        supplier: true,
        units: true,
        batches: {
          include: {
            stockMovements: {
              take: 5,
              orderBy: { createdAt: 'desc' },
              include: {
                user: { select: { id: true, fullName: true, username: true } }
              }
            }
          },
          orderBy: { expiryDate: 'asc' }
        }
      }
    });

    if (!medicine || medicine.deletedAt) {
      throw new NotFoundException(`Medicine #${id} not found or has been deactivated`);
    }

    // Compute metrics
    const now = new Date();
    const activeBatches = medicine.batches.filter((b) => b.status === BatchStatus.ACTIVE);
    const validBatches = activeBatches.filter((b) => new Date(b.expiryDate) > now);
    const availableStock = validBatches.reduce((sum, b) => sum + Number(b.quantityOnHand), 0);
    const totalStock = medicine.batches.reduce((sum, b) => sum + Number(b.quantityOnHand), 0);

    const cost = medicine.purchasePrice ? Number(medicine.purchasePrice) : 0;
    const sell = medicine.sellingPrice ? Number(medicine.sellingPrice) : 0;
    const profitAmount = Math.max(0, sell - cost);
    const profitMargin = sell > 0 ? ((profitAmount / sell) * 100).toFixed(2) : '0.00';

    return {
      ...medicine,
      availableStock,
      totalStock,
      profitAmount,
      profitMargin: parseFloat(profitMargin)
    };
  }

  async create(dto: CreateMedicineDto, userId?: string) {
    // 1. Auto-generate or validate SKU Code
    const skuCode = dto.skuCode ? dto.skuCode.trim() : await this.generateSkuCode();

    const existingSku = await this.prisma.medicine.findUnique({
      where: { skuCode }
    });
    if (existingSku) {
      throw new ConflictException(`Medicine Code (SKU) "${skuCode}" is already in use.`);
    }

    // 2. Barcode uniqueness check
    if (dto.barcode && dto.barcode.trim().length > 0) {
      const existingBarcode = await this.prisma.medicine.findFirst({
        where: { barcode: dto.barcode.trim() }
      });
      if (existingBarcode) {
        throw new ConflictException(`Barcode "${dto.barcode}" is already registered to "${existingBarcode.brandName}".`);
      }
    }

    // 3. Duplicate Prevention: Check identical Brand + Strength + DosageForm
    const normalizedDosageForm = normalizeDosageForm(dto.dosageForm);
    const duplicate = await this.prisma.medicine.findFirst({
      where: {
        brandName: dto.brandName.trim(),
        strength: dto.strength.trim(),
        dosageForm: normalizedDosageForm,
        deletedAt: null
      }
    });
    if (duplicate) {
      throw new ConflictException(
        `Medicine "${dto.brandName} ${dto.strength} (${dto.dosageForm})" already exists in the system (SKU: ${duplicate.skuCode}).`
      );
    }

    // 4. MRP & Price Validations
    const currency = process.env.DEFAULT_CURRENCY || 'LKR';
    if (dto.mrp !== undefined && dto.sellingPrice !== undefined && dto.mrp > 0) {
      if (dto.sellingPrice > dto.mrp) {
        throw new BadRequestException(
          `Selling Price (${currency} ${dto.sellingPrice}) cannot exceed Maximum Retail Price MRP (${currency} ${dto.mrp}).`
        );
      }
    }

    // 5. Atomic Creation Transaction
    return await this.prisma.$transaction(async (tx) => {
      // Create master medicine record
      const medicine = await tx.medicine.create({
        data: {
          categoryId: BigInt(dto.categoryId),
          subCategory: dto.subCategory || null,
          subCategoryId: dto.subCategoryId ? BigInt(dto.subCategoryId) : null,
          dosageFormId: dto.dosageFormId ? BigInt(dto.dosageFormId) : null,
          manufacturerId: dto.manufacturerId ? BigInt(dto.manufacturerId) : null,
          genericId: dto.genericId ? BigInt(dto.genericId) : null,
          supplierId: dto.supplierId ? BigInt(dto.supplierId) : null,
          name: dto.name.trim(),
          brandName: dto.brandName.trim(),
          skuCode,
          barcode: dto.barcode ? dto.barcode.trim() : null,
          strength: dto.strength.trim(),
          dosageForm: normalizedDosageForm,
          composition: dto.composition || null,
          packSize: dto.packSize || null,
          baseUnit: dto.baseUnit || 'TABLET',
          purchaseUnit: dto.purchaseUnit || null,
          route: dto.route || 'Oral',
          prescriptionRequired: dto.prescriptionRequired ?? false,
          isNarcotic: dto.isNarcotic ?? false,
          reorderLevel: new Prisma.Decimal(dto.reorderLevel ?? 50),
          maxStockLevel: dto.maxStockLevel ? new Prisma.Decimal(dto.maxStockLevel) : null,
          rackLocation: dto.rackLocation || null,
          warehouseLocation: dto.warehouseLocation || null,
          storageCondition: dto.storageCondition || 'Store below 25°C',
          purchasePrice: dto.purchasePrice !== undefined ? new Prisma.Decimal(dto.purchasePrice) : null,
          sellingPrice: dto.sellingPrice !== undefined ? new Prisma.Decimal(dto.sellingPrice) : null,
          wholesalePrice: dto.wholesalePrice !== undefined ? new Prisma.Decimal(dto.wholesalePrice) : null,
          mrp: dto.mrp !== undefined ? new Prisma.Decimal(dto.mrp) : null,
          discountPercentage: new Prisma.Decimal(dto.discountPercentage ?? 0),
          taxPercentage: new Prisma.Decimal(dto.taxPercentage ?? 0),
          imageUrl: dto.imageUrl || null,
          lowStockAlert: dto.lowStockAlert ?? true,
          expiryAlert: dto.expiryAlert ?? true,
          description: dto.description || null,
          notes: dto.notes || null,
          isActive: dto.isActive ?? true
        }
      });

      // Create default packaging conversion if configured
      if (dto.purchaseUnit && dto.conversionFactor && dto.conversionFactor > 0) {
        await tx.medicinePackaging.create({
          data: {
            medicineId: medicine.id,
            purchaseUnitName: dto.purchaseUnit.trim(),
            packSize: dto.packSize || `${dto.conversionFactor} ${dto.baseUnit || 'Units'} / ${dto.purchaseUnit}`,
            conversionFactor: new Prisma.Decimal(dto.conversionFactor),
            baseUnitName: dto.baseUnit || 'TABLET',
            sellingUnitName: dto.sellingUnit || dto.baseUnit || 'TABLET',
            isDefault: true
          }
        });
      }

      // Create optional packaging units
      if (dto.units && dto.units.length > 0) {
        for (const u of dto.units) {
          await tx.medicineUnit.create({
            data: {
              medicineId: medicine.id,
              unitName: u.unitName.trim(),
              baseUnitFactor: new Prisma.Decimal(u.baseUnitFactor),
              barcode: u.barcode ? u.barcode.trim() : null,
              isSellable: true
            }
          });
        }
      }

      // Create Initial Batch and Stock Movement if provided
      if (dto.initialStockQuantity && dto.initialStockQuantity > 0 && dto.initialBatchNumber) {
        if (!dto.expiryDate) {
          throw new BadRequestException('Expiry date is mandatory when initializing stock batch.');
        }

        const expDate = new Date(dto.expiryDate);
        const now = new Date();
        const thirtyDays = new Date();
        thirtyDays.setDate(now.getDate() + 30);

        let initialBatchStatus: BatchStatus = BatchStatus.ACTIVE;
        if (expDate <= now) {
          initialBatchStatus = BatchStatus.EXPIRED;
        } else if (expDate <= thirtyDays) {
          initialBatchStatus = BatchStatus.NEAR_EXPIRY;
        }

        const cost = dto.purchasePrice !== undefined ? dto.purchasePrice : 0;
        const sell = dto.sellingPrice !== undefined ? dto.sellingPrice : 0;

        const batch = await tx.medicineBatch.create({
          data: {
            medicineId: medicine.id,
            batchNumber: dto.initialBatchNumber.trim(),
            mfgDate: dto.mfgDate ? new Date(dto.mfgDate) : null,
            expiryDate: expDate,
            costPrice: new Prisma.Decimal(cost),
            sellingPrice: new Prisma.Decimal(sell),
            quantityOnHand: new Prisma.Decimal(dto.initialStockQuantity),
            rackLocation: dto.rackLocation || null,
            status: initialBatchStatus
          }
        });

        // Immutable stock movement ledger entry
        await tx.stockMovement.create({
          data: {
            batchId: batch.id,
            movementType: MovementType.PURCHASE,
            quantityDelta: new Prisma.Decimal(dto.initialStockQuantity),
            balanceAfter: new Prisma.Decimal(dto.initialStockQuantity),
            referenceType: 'INITIAL_STOCK',
            referenceId: medicine.id,
            userId: userId ? BigInt(userId) : BigInt(1),
            note: `Initial opening inventory stock batch ${dto.initialBatchNumber}`
          }
        });
      }

      // Record Audit Log
      await this.auditLogsService.log({
        userId,
        action: 'MEDICINE_CREATE',
        entityType: 'MEDICINE',
        entityId: medicine.id.toString(),
        afterData: {
          skuCode: medicine.skuCode,
          brandName: medicine.brandName,
          name: medicine.name,
          initialStock: dto.initialStockQuantity || 0
        }
      });

      return medicine;
    });
  }

  async update(id: string, dto: Partial<CreateMedicineDto>, userId?: string) {
    const med = await this.findOne(id);

    // Validate barcode uniqueness if updated
    if (dto.barcode && dto.barcode.trim() !== med.barcode) {
      const existing = await this.prisma.medicine.findFirst({
        where: { barcode: dto.barcode.trim(), NOT: { id: med.id } }
      });
      if (existing) {
        throw new ConflictException(`Barcode "${dto.barcode}" is already assigned to another medicine.`);
      }
    }

    // Validate MRP rule
    const newSell = dto.sellingPrice !== undefined ? dto.sellingPrice : Number(med.sellingPrice || 0);
    const newMrp = dto.mrp !== undefined ? dto.mrp : Number(med.mrp || 0);
    if (newMrp > 0 && newSell > newMrp) {
      const currency = process.env.DEFAULT_CURRENCY || 'LKR';
      throw new BadRequestException(`Selling Price (${currency} ${newSell}) cannot exceed MRP (${currency} ${newMrp}).`);
    }

    const updated = await this.prisma.medicine.update({
      where: { id: med.id },
      data: {
        ...(dto.categoryId ? { categoryId: BigInt(dto.categoryId) } : {}),
        ...(dto.subCategory !== undefined ? { subCategory: dto.subCategory || null } : {}),
        ...(dto.subCategoryId !== undefined ? { subCategoryId: dto.subCategoryId ? BigInt(dto.subCategoryId) : null } : {}),
        ...(dto.dosageFormId !== undefined ? { dosageFormId: dto.dosageFormId ? BigInt(dto.dosageFormId) : null } : {}),
        ...(dto.purchaseUnit !== undefined ? { purchaseUnit: dto.purchaseUnit || null } : {}),
        ...(dto.manufacturerId !== undefined ? { manufacturerId: dto.manufacturerId ? BigInt(dto.manufacturerId) : null } : {}),
        ...(dto.genericId !== undefined ? { genericId: dto.genericId ? BigInt(dto.genericId) : null } : {}),
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId ? BigInt(dto.supplierId) : null } : {}),
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.brandName ? { brandName: dto.brandName.trim() } : {}),
        ...(dto.barcode !== undefined ? { barcode: dto.barcode ? dto.barcode.trim() : null } : {}),
        ...(dto.strength ? { strength: dto.strength.trim() } : {}),
        ...(dto.dosageForm ? { dosageForm: normalizeDosageForm(dto.dosageForm) } : {}),
        ...(dto.composition !== undefined ? { composition: dto.composition || null } : {}),
        ...(dto.packSize !== undefined ? { packSize: dto.packSize || null } : {}),
        ...(dto.baseUnit ? { baseUnit: dto.baseUnit } : {}),
        ...(dto.route !== undefined ? { route: dto.route || null } : {}),
        ...(dto.storageCondition !== undefined ? { storageCondition: dto.storageCondition || null } : {}),
        ...(dto.prescriptionRequired !== undefined ? { prescriptionRequired: dto.prescriptionRequired } : {}),
        ...(dto.isNarcotic !== undefined ? { isNarcotic: dto.isNarcotic } : {}),
        ...(dto.reorderLevel !== undefined ? { reorderLevel: new Prisma.Decimal(dto.reorderLevel) } : {}),
        ...(dto.maxStockLevel !== undefined ? { maxStockLevel: dto.maxStockLevel ? new Prisma.Decimal(dto.maxStockLevel) : null } : {}),
        ...(dto.rackLocation !== undefined ? { rackLocation: dto.rackLocation || null } : {}),
        ...(dto.warehouseLocation !== undefined ? { warehouseLocation: dto.warehouseLocation || null } : {}),
        ...(dto.purchasePrice !== undefined ? { purchasePrice: dto.purchasePrice ? new Prisma.Decimal(dto.purchasePrice) : null } : {}),
        ...(dto.sellingPrice !== undefined ? { sellingPrice: dto.sellingPrice ? new Prisma.Decimal(dto.sellingPrice) : null } : {}),
        ...(dto.wholesalePrice !== undefined ? { wholesalePrice: dto.wholesalePrice ? new Prisma.Decimal(dto.wholesalePrice) : null } : {}),
        ...(dto.mrp !== undefined ? { mrp: dto.mrp ? new Prisma.Decimal(dto.mrp) : null } : {}),
        ...(dto.discountPercentage !== undefined ? { discountPercentage: new Prisma.Decimal(dto.discountPercentage) } : {}),
        ...(dto.taxPercentage !== undefined ? { taxPercentage: new Prisma.Decimal(dto.taxPercentage) } : {}),
        ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl || null } : {}),
        ...(dto.lowStockAlert !== undefined ? { lowStockAlert: dto.lowStockAlert } : {}),
        ...(dto.expiryAlert !== undefined ? { expiryAlert: dto.expiryAlert } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      }
    });

    // Record Audit Log
    await this.auditLogsService.log({
      userId,
      action: 'MEDICINE_UPDATE',
      entityType: 'MEDICINE',
      entityId: med.id.toString(),
      beforeData: { brandName: med.brandName, skuCode: med.skuCode, sellingPrice: med.sellingPrice },
      afterData: { brandName: updated.brandName, sellingPrice: updated.sellingPrice }
    });

    return updated;
  }

  async toggleActive(id: string, userId?: string) {
    const med = await this.findOne(id);
    const updated = await this.prisma.medicine.update({
      where: { id: med.id },
      data: { isActive: !med.isActive }
    });

    await this.auditLogsService.log({
      userId,
      action: updated.isActive ? 'MEDICINE_ACTIVATE' : 'MEDICINE_DEACTIVATE',
      entityType: 'MEDICINE',
      entityId: med.id.toString(),
      afterData: { isActive: updated.isActive }
    });

    return updated;
  }

  async softDelete(id: string, userId?: string) {
    const med = await this.findOne(id);

    // Safety Check: Verify whether historical sales exist
    const salesCount = await this.prisma.saleItem.count({
      where: { medicineId: med.id }
    });

    // Soft delete
    const archived = await this.prisma.medicine.update({
      where: { id: med.id },
      data: { deletedAt: new Date(), isActive: false }
    });

    await this.auditLogsService.log({
      userId,
      action: 'MEDICINE_SOFT_DELETE',
      entityType: 'MEDICINE',
      entityId: med.id.toString(),
      beforeData: { brandName: med.brandName, skuCode: med.skuCode, salesCount }
    });

    return {
      success: true,
      message: `Medicine "${med.brandName}" (${med.skuCode}) archived safely.`,
      hadTransactions: salesCount > 0
    };
  }

  async getBatches(medicineId: string) {
    await this.findOne(medicineId);
    return await this.prisma.medicineBatch.findMany({
      where: { medicineId: BigInt(medicineId) },
      orderBy: { expiryDate: 'asc' },
      include: {
        stockMovements: {
          take: 3,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  async getStockHistory(medicineId: string) {
    const med = await this.findOne(medicineId);
    return await this.prisma.stockMovement.findMany({
      where: {
        batch: { medicineId: med.id }
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        batch: {
          select: { id: true, batchNumber: true, expiryDate: true }
        },
        user: {
          select: { id: true, fullName: true, username: true }
        }
      }
    });
  }

  async getCategories() {
    return await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        subCategories: true
      }
    });
  }

  async getGenerics() {
    return await this.prisma.genericMolecule.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async getManufacturers() {
    return await this.prisma.manufacturer.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
  }

  async getSuppliers() {
    return await this.prisma.supplier.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        phone: true,
        contactPerson: true,
        paymentTerms: true
      },
      orderBy: { name: 'asc' }
    });
  }

  async getBrands() {
    const brands = await this.prisma.medicine.groupBy({
      by: ['brandName'],
      where: { deletedAt: null },
      _count: { id: true },
      orderBy: { brandName: 'asc' }
    });
    return brands.map((b) => ({
      brandName: b.brandName,
      count: b._count.id
    }));
  }

  async createManufacturer(data: { name: string; country?: string; contactPhone?: string }) {
    const cleanName = data.name.trim();
    const existing = await this.prisma.manufacturer.findFirst({
      where: { name: cleanName }
    });
    if (existing) {
      throw new ConflictException(`Manufacturer "${cleanName}" already exists.`);
    }
    return await this.prisma.manufacturer.create({
      data: {
        name: cleanName,
        country: data.country?.trim() || null,
        contactPhone: data.contactPhone?.trim() || null,
        isActive: true
      }
    });
  }

  async updateManufacturer(id: string, data: Partial<{ name: string; country?: string; contactPhone?: string; isActive?: boolean }>) {
    return await this.prisma.manufacturer.update({
      where: { id: BigInt(id) },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.country !== undefined ? { country: data.country?.trim() || null } : {}),
        ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
      }
    });
  }

  async deleteManufacturer(id: string) {
    const count = await this.prisma.medicine.count({
      where: { manufacturerId: BigInt(id), deletedAt: null }
    });
    if (count > 0) {
      throw new BadRequestException(`Cannot delete manufacturer linked to ${count} medicine(s). You can deactivate it instead.`);
    }
    await this.prisma.manufacturer.delete({ where: { id: BigInt(id) } });
    return { success: true, message: 'Manufacturer deleted successfully' };
  }

  async createGeneric(data: { name: string; therapeuticClass?: string; notes?: string }) {
    const cleanName = data.name.trim();
    const existing = await this.prisma.genericMolecule.findFirst({
      where: { name: cleanName }
    });
    if (existing) {
      throw new ConflictException(`Generic Molecule "${cleanName}" already exists.`);
    }
    return await this.prisma.genericMolecule.create({
      data: {
        name: cleanName,
        therapeuticClass: data.therapeuticClass?.trim() || null,
        notes: data.notes?.trim() || null
      }
    });
  }

  async updateGeneric(id: string, data: Partial<{ name: string; therapeuticClass?: string; notes?: string }>) {
    return await this.prisma.genericMolecule.update({
      where: { id: BigInt(id) },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.therapeuticClass !== undefined ? { therapeuticClass: data.therapeuticClass?.trim() || null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {})
      }
    });
  }

  async deleteGeneric(id: string) {
    const count = await this.prisma.medicine.count({
      where: { genericId: BigInt(id), deletedAt: null }
    });
    if (count > 0) {
      throw new BadRequestException(`Cannot delete generic molecule linked to ${count} medicine(s).`);
    }
    await this.prisma.genericMolecule.delete({ where: { id: BigInt(id) } });
    return { success: true, message: 'Generic molecule deleted successfully' };
  }

  async bulkImport(items: any[], userId?: string) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Import payload must contain a non-empty array of medicines.');
    }

    // Default category fallback
    let defaultCategory = await this.prisma.category.findFirst({
      where: { isActive: true },
      orderBy: { id: 'asc' }
    });
    if (!defaultCategory) {
      defaultCategory = await this.prisma.category.create({
        data: { name: 'General Medicines', code: 'GEN' }
      });
    }

    const categories = await this.prisma.category.findMany({ select: { id: true, name: true } });
    const categoryMap = new Map<string, bigint>();
    categories.forEach((c) => categoryMap.set(c.name.toLowerCase().trim(), c.id));

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (let index = 0; index < items.length; index++) {
      const row = items[index];
      const rowNum = index + 1;

      try {
        const brandName = (row.brandName || row.name || '').trim();
        const genericName = (row.name || row.genericName || brandName).trim();
        const strength = (row.strength || 'N/A').trim();

        if (!brandName) {
          skippedCount++;
          errors.push(`Row ${rowNum}: Brand Name is required.`);
          continue;
        }

        // Determine dosage form
        let formStr = (row.dosageForm || 'TABLET').toUpperCase().trim();
        const validForms = ['TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'CREAM', 'OINTMENT'];
        if (!validForms.includes(formStr)) {
          formStr = 'TABLET';
        }

        // Check duplicate
        const existing = await this.prisma.medicine.findFirst({
          where: {
            brandName,
            strength,
            dosageForm: formStr as any,
            deletedAt: null
          }
        });
        if (existing) {
          skippedCount++;
          errors.push(`Row ${rowNum}: "${brandName} ${strength}" already exists (SKU: ${existing.skuCode}).`);
          continue;
        }

        // Resolve Category
        let catId = defaultCategory.id;
        if (row.categoryName && categoryMap.has(row.categoryName.toLowerCase().trim())) {
          catId = categoryMap.get(row.categoryName.toLowerCase().trim())!;
        } else if (row.categoryId) {
          catId = BigInt(row.categoryId);
        }

        // Resolve or create Manufacturer
        let manufacturerId: bigint | null = null;
        if (row.manufacturerName && row.manufacturerName.trim()) {
          const mfgName = row.manufacturerName.trim();
          let mfg = await this.prisma.manufacturer.findFirst({ where: { name: mfgName } });
          if (!mfg) {
            mfg = await this.prisma.manufacturer.create({ data: { name: mfgName, isActive: true } });
          }
          manufacturerId = mfg.id;
        }

        // Resolve or create Generic
        let genericId: bigint | null = null;
        if (genericName) {
          let gen = await this.prisma.genericMolecule.findFirst({ where: { name: genericName } });
          if (!gen) {
            gen = await this.prisma.genericMolecule.create({ data: { name: genericName } });
          }
          genericId = gen.id;
        }

        // Unique SKU
        let skuCode = row.skuCode?.trim();
        if (!skuCode) {
          skuCode = await this.generateSkuCode();
        } else {
          const skuExists = await this.prisma.medicine.findUnique({ where: { skuCode } });
          if (skuExists) {
            skuCode = await this.generateSkuCode();
          }
        }

        // Barcode
        const barcode = row.barcode && row.barcode.trim() ? row.barcode.trim() : null;

        const purchasePrice = row.purchasePrice ? Number(row.purchasePrice) : null;
        const sellingPrice = row.sellingPrice ? Number(row.sellingPrice) : null;
        const mrp = row.mrp ? Number(row.mrp) : sellingPrice;

        const createdMed = await this.prisma.medicine.create({
          data: {
            categoryId: catId,
            subCategory: row.subCategory || null,
            manufacturerId,
            genericId,
            name: genericName,
            brandName,
            skuCode,
            barcode,
            strength,
            dosageForm: formStr as any,
            composition: row.composition || null,
            packSize: row.packSize || null,
            baseUnit: (row.baseUnit || 'TABLET').toUpperCase().trim(),
            purchaseUnit: row.purchaseUnit || null,
            route: row.route || 'Oral',
            prescriptionRequired: row.prescriptionRequired === true || String(row.prescriptionRequired).toLowerCase() === 'true' || String(row.prescriptionRequired).toLowerCase() === 'yes',
            isNarcotic: row.isNarcotic === true || String(row.isNarcotic).toLowerCase() === 'true',
            reorderLevel: new Prisma.Decimal(row.reorderLevel || 50),
            rackLocation: row.rackLocation || null,
            storageCondition: row.storageCondition || 'Store below 25°C',
            purchasePrice: purchasePrice ? new Prisma.Decimal(purchasePrice) : null,
            sellingPrice: sellingPrice ? new Prisma.Decimal(sellingPrice) : null,
            mrp: mrp ? new Prisma.Decimal(mrp) : null,
            discountPercentage: new Prisma.Decimal(row.discountPercentage || 0),
            description: row.description || null,
            notes: row.notes || row.sideEffects ? `${row.notes || ''} ${row.sideEffects ? `[Side Effects: ${row.sideEffects}]` : ''}`.trim() : null,
            imageUrl: row.imageUrl || null,
            isActive: true
          }
        });

        // If initial batch / stock provided
        const initialQty = Number(row.initialStock || row.quantity || 0);
        if (initialQty > 0) {
          const batchNumber = row.initialBatchNumber || row.batchNumber || `LOT-${new Date().getFullYear()}-${String(index + 1).padStart(3, '0')}`;
          const expDate = row.expiryDate ? new Date(row.expiryDate) : new Date(Date.now() + 365 * 24 * 3600 * 1000);

          const batch = await this.prisma.medicineBatch.create({
            data: {
              medicineId: createdMed.id,
              batchNumber,
              expiryDate: expDate,
              mfgDate: row.mfgDate ? new Date(row.mfgDate) : null,
              costPrice: new Prisma.Decimal(purchasePrice || 0),
              sellingPrice: new Prisma.Decimal(sellingPrice || 0),
              quantityOnHand: new Prisma.Decimal(initialQty),
              status: BatchStatus.ACTIVE
            }
          });

          await this.prisma.stockMovement.create({
            data: {
              batchId: batch.id,
              userId: userId ? BigInt(userId) : 1n,
              movementType: MovementType.PURCHASE,
              quantityDelta: new Prisma.Decimal(initialQty),
              balanceAfter: new Prisma.Decimal(initialQty),
              referenceType: 'INITIAL_STOCK',
              referenceId: batch.id,
              note: 'Bulk catalog import initial stock balance'
            }
          });
        }

        importedCount++;
      } catch (err: any) {
        skippedCount++;
        errors.push(`Row ${rowNum}: ${err.message || 'Error importing medicine'}`);
      }
    }

    if (userId) {
      await this.auditLogsService.log({
        userId,
        action: 'MEDICINE_BULK_IMPORT',
        entityType: 'MEDICINE',
        entityId: '0',
        afterData: { importedCount, skippedCount, errorsCount: errors.length }
      });
    }

    return {
      success: true,
      importedCount,
      skippedCount,
      totalProcessed: items.length,
      errors: errors.slice(0, 20)
    };
  }
}
