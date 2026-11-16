import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ClassificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  // =========================================================================
  // 1. MEDICINE CATEGORIES
  // =========================================================================

  async getCategories(search?: string, isActive?: boolean) {
    const where: Prisma.CategoryWhereInput = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { description: { contains: q } }
      ];
    }

    const categories = await this.prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            medicines: { where: { deletedAt: null } },
            subCategories: true
          }
        }
      }
    });

    return categories.map((c) => ({
      ...c,
      id: c.id.toString(),
      medicineCount: c._count.medicines,
      subcategoryCount: c._count.subCategories
    }));
  }

  async getCategoryById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: BigInt(id) },
      include: {
        subCategories: true,
        _count: {
          select: { medicines: { where: { deletedAt: null } } }
        }
      }
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return {
      ...category,
      id: category.id.toString(),
      medicineCount: category._count.medicines,
      subCategories: category.subCategories.map((s) => ({
        ...s,
        id: s.id.toString(),
        categoryId: s.categoryId.toString()
      }))
    };
  }

  async createCategory(
    data: { name: string; code?: string; description?: string; imageUrl?: string; isActive?: boolean },
    userId?: string
  ) {
    const code = (data.code || data.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')).trim();

    const existing = await this.prisma.category.findFirst({
      where: {
        OR: [{ name: data.name.trim() }, { code }]
      }
    });
    if (existing) {
      throw new ConflictException(`Category with name "${data.name}" or code "${code}" already exists`);
    }

    const created = await this.prisma.category.create({
      data: {
        name: data.name.trim(),
        code,
        description: data.description?.trim() || null,
        imageUrl: data.imageUrl?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });

    await this.auditLogsService.log({
      userId,
      action: 'CATEGORY_CREATE',
      entityType: 'CATEGORY',
      entityId: created.id.toString(),
      afterData: { name: created.name, code: created.code }
    });

    return { ...created, id: created.id.toString() };
  }

  async updateCategory(
    id: string,
    data: { name?: string; description?: string; imageUrl?: string; isActive?: boolean },
    userId?: string
  ) {
    const cat = await this.prisma.category.findUnique({ where: { id: BigInt(id) } });
    if (!cat) throw new NotFoundException(`Category not found`);

    if (data.name && data.name.trim() !== cat.name) {
      const duplicate = await this.prisma.category.findFirst({
        where: { name: data.name.trim(), id: { not: cat.id } }
      });
      if (duplicate) {
        throw new ConflictException(`Another category with name "${data.name}" already exists`);
      }
    }

    const updated = await this.prisma.category.update({
      where: { id: cat.id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
      }
    });

    await this.auditLogsService.log({
      userId,
      action: 'CATEGORY_UPDATE',
      entityType: 'CATEGORY',
      entityId: cat.id.toString(),
      beforeData: { name: cat.name, isActive: cat.isActive },
      afterData: { name: updated.name, isActive: updated.isActive }
    });

    return { ...updated, id: updated.id.toString() };
  }

  async toggleCategoryActive(id: string, userId?: string) {
    const cat = await this.prisma.category.findUnique({ where: { id: BigInt(id) } });
    if (!cat) throw new NotFoundException(`Category not found`);

    const updated = await this.prisma.category.update({
      where: { id: cat.id },
      data: { isActive: !cat.isActive }
    });

    await this.auditLogsService.log({
      userId,
      action: updated.isActive ? 'CATEGORY_ACTIVATE' : 'CATEGORY_DEACTIVATE',
      entityType: 'CATEGORY',
      entityId: cat.id.toString(),
      afterData: { isActive: updated.isActive }
    });

    return { ...updated, id: updated.id.toString() };
  }

  async deleteCategory(id: string, userId?: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id: BigInt(id) },
      include: {
        _count: {
          select: { medicines: { where: { deletedAt: null } } }
        }
      }
    });
    if (!cat) throw new NotFoundException(`Category not found`);

    if (cat._count.medicines > 0) {
      throw new BadRequestException(
        `Cannot delete Category "${cat.name}" because it is currently assigned to ${cat._count.medicines} active medicine(s). Please deactivate the category instead.`
      );
    }

    await this.prisma.category.delete({ where: { id: cat.id } });

    await this.auditLogsService.log({
      userId,
      action: 'CATEGORY_DELETE',
      entityType: 'CATEGORY',
      entityId: cat.id.toString(),
      beforeData: { name: cat.name, code: cat.code }
    });

    return { success: true, message: `Category "${cat.name}" deleted successfully` };
  }

  // =========================================================================
  // 2. MEDICINE SUBCATEGORIES
  // =========================================================================

  async getSubcategories(categoryId?: string, search?: string, isActive?: boolean) {
    const where: Prisma.SubCategoryWhereInput = {};
    if (categoryId) {
      where.categoryId = BigInt(categoryId);
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { description: { contains: q } }
      ];
    }

    const subcategories = await this.prisma.subCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        category: {
          select: { id: true, name: true, code: true }
        },
        _count: {
          select: { medicines: { where: { deletedAt: null } } }
        }
      }
    });

    return subcategories.map((s) => ({
      ...s,
      id: s.id.toString(),
      categoryId: s.categoryId.toString(),
      category: {
        ...s.category,
        id: s.category.id.toString()
      },
      medicineCount: s._count.medicines
    }));
  }

  async createSubcategory(
    data: { categoryId: string; name: string; code?: string; description?: string; isActive?: boolean },
    userId?: string
  ) {
    const category = await this.prisma.category.findUnique({
      where: { id: BigInt(data.categoryId) }
    });
    if (!category) {
      throw new NotFoundException(`Parent Category with ID ${data.categoryId} not found`);
    }

    const cleanName = data.name.trim();
    const code = (
      data.code || `${category.code}_${cleanName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
    ).trim();

    // Prevent duplicate under same parent category
    const existing = await this.prisma.subCategory.findFirst({
      where: {
        categoryId: category.id,
        OR: [{ name: cleanName }, { code }]
      }
    });
    if (existing) {
      throw new ConflictException(
        `Subcategory "${cleanName}" already exists under category "${category.name}"`
      );
    }

    const created = await this.prisma.subCategory.create({
      data: {
        categoryId: category.id,
        name: cleanName,
        code,
        description: data.description?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true
      },
      include: {
        category: { select: { id: true, name: true, code: true } }
      }
    });

    await this.auditLogsService.log({
      userId,
      action: 'SUBCATEGORY_CREATE',
      entityType: 'SUBCATEGORY',
      entityId: created.id.toString(),
      afterData: { name: created.name, category: category.name }
    });

    return {
      ...created,
      id: created.id.toString(),
      categoryId: created.categoryId.toString(),
      category: { ...created.category, id: created.category.id.toString() }
    };
  }

  async updateSubcategory(
    id: string,
    data: { name?: string; description?: string; isActive?: boolean },
    userId?: string
  ) {
    const sub = await this.prisma.subCategory.findUnique({ where: { id: BigInt(id) } });
    if (!sub) throw new NotFoundException(`Subcategory not found`);

    if (data.name && data.name.trim() !== sub.name) {
      const duplicate = await this.prisma.subCategory.findFirst({
        where: {
          categoryId: sub.categoryId,
          name: data.name.trim(),
          id: { not: sub.id }
        }
      });
      if (duplicate) {
        throw new ConflictException(
          `Subcategory "${data.name}" already exists under this category`
        );
      }
    }

    const updated = await this.prisma.subCategory.update({
      where: { id: sub.id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
      },
      include: {
        category: { select: { id: true, name: true, code: true } }
      }
    });

    await this.auditLogsService.log({
      userId,
      action: 'SUBCATEGORY_UPDATE',
      entityType: 'SUBCATEGORY',
      entityId: sub.id.toString(),
      beforeData: { name: sub.name, isActive: sub.isActive },
      afterData: { name: updated.name, isActive: updated.isActive }
    });

    return {
      ...updated,
      id: updated.id.toString(),
      categoryId: updated.categoryId.toString(),
      category: { ...updated.category, id: updated.category.id.toString() }
    };
  }

  async toggleSubcategoryActive(id: string, userId?: string) {
    const sub = await this.prisma.subCategory.findUnique({ where: { id: BigInt(id) } });
    if (!sub) throw new NotFoundException(`Subcategory not found`);

    const updated = await this.prisma.subCategory.update({
      where: { id: sub.id },
      data: { isActive: !sub.isActive }
    });

    return {
      ...updated,
      id: updated.id.toString(),
      categoryId: updated.categoryId.toString()
    };
  }

  async deleteSubcategory(id: string, userId?: string) {
    const sub = await this.prisma.subCategory.findUnique({
      where: { id: BigInt(id) },
      include: {
        _count: {
          select: { medicines: { where: { deletedAt: null } } }
        }
      }
    });
    if (!sub) throw new NotFoundException(`Subcategory not found`);

    if (sub._count.medicines > 0) {
      throw new BadRequestException(
        `Cannot delete Subcategory "${sub.name}" because it is currently assigned to ${sub._count.medicines} active medicine(s). Please deactivate it instead.`
      );
    }

    await this.prisma.subCategory.delete({ where: { id: sub.id } });

    await this.auditLogsService.log({
      userId,
      action: 'SUBCATEGORY_DELETE',
      entityType: 'SUBCATEGORY',
      entityId: sub.id.toString(),
      beforeData: { name: sub.name, code: sub.code }
    });

    return { success: true, message: `Subcategory "${sub.name}" deleted successfully` };
  }

  // =========================================================================
  // 3. DOSAGE FORMS
  // =========================================================================

  async getDosageForms(categoryGroup?: string, search?: string, isActive?: boolean) {
    const where: Prisma.DosageFormMasterWhereInput = {};
    if (categoryGroup) {
      where.categoryGroup = categoryGroup;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { categoryGroup: { contains: q } },
        { description: { contains: q } }
      ];
    }

    const forms = await this.prisma.dosageFormMaster.findMany({
      where,
      orderBy: [{ categoryGroup: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { medicines: { where: { deletedAt: null } } }
        }
      }
    });

    return forms.map((f) => ({
      ...f,
      id: f.id.toString(),
      medicineCount: f._count.medicines
    }));
  }

  async createDosageForm(
    data: { name: string; categoryGroup: string; description?: string; isActive?: boolean },
    userId?: string
  ) {
    const cleanName = data.name.trim();
    const existing = await this.prisma.dosageFormMaster.findUnique({
      where: { name: cleanName }
    });
    if (existing) {
      throw new ConflictException(`Dosage form "${cleanName}" already exists`);
    }

    const created = await this.prisma.dosageFormMaster.create({
      data: {
        name: cleanName,
        categoryGroup: data.categoryGroup.trim(),
        description: data.description?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });

    await this.auditLogsService.log({
      userId,
      action: 'DOSAGE_FORM_CREATE',
      entityType: 'DOSAGE_FORM',
      entityId: created.id.toString(),
      afterData: { name: created.name, group: created.categoryGroup }
    });

    return { ...created, id: created.id.toString() };
  }

  async updateDosageForm(
    id: string,
    data: { name?: string; categoryGroup?: string; description?: string; isActive?: boolean },
    userId?: string
  ) {
    const form = await this.prisma.dosageFormMaster.findUnique({ where: { id: BigInt(id) } });
    if (!form) throw new NotFoundException(`Dosage Form not found`);

    if (data.name && data.name.trim() !== form.name) {
      const duplicate = await this.prisma.dosageFormMaster.findUnique({
        where: { name: data.name.trim() }
      });
      if (duplicate && duplicate.id !== form.id) {
        throw new ConflictException(`Dosage form "${data.name}" already exists`);
      }
    }

    const updated = await this.prisma.dosageFormMaster.update({
      where: { id: form.id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.categoryGroup ? { categoryGroup: data.categoryGroup.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
      }
    });

    return { ...updated, id: updated.id.toString() };
  }

  async toggleDosageFormActive(id: string, userId?: string) {
    const form = await this.prisma.dosageFormMaster.findUnique({ where: { id: BigInt(id) } });
    if (!form) throw new NotFoundException(`Dosage Form not found`);

    const updated = await this.prisma.dosageFormMaster.update({
      where: { id: form.id },
      data: { isActive: !form.isActive }
    });

    return { ...updated, id: updated.id.toString() };
  }

  async deleteDosageForm(id: string, userId?: string) {
    const form = await this.prisma.dosageFormMaster.findUnique({
      where: { id: BigInt(id) },
      include: {
        _count: {
          select: { medicines: { where: { deletedAt: null } } }
        }
      }
    });
    if (!form) throw new NotFoundException(`Dosage Form not found`);

    if (form._count.medicines > 0) {
      throw new BadRequestException(
        `Cannot delete Dosage Form "${form.name}" because it is currently assigned to ${form._count.medicines} active medicine(s). Please deactivate it instead.`
      );
    }

    await this.prisma.dosageFormMaster.delete({ where: { id: form.id } });

    await this.auditLogsService.log({
      userId,
      action: 'DOSAGE_FORM_DELETE',
      entityType: 'DOSAGE_FORM',
      entityId: form.id.toString(),
      beforeData: { name: form.name }
    });

    return { success: true, message: `Dosage form "${form.name}" deleted successfully` };
  }

  // =========================================================================
  // 4. SELLING UNITS
  // =========================================================================

  async getSellingUnits(search?: string, unitType?: string, isActive?: boolean) {
    const where: Prisma.SellingUnitWhereInput = {};
    if (unitType) {
      where.unitType = unitType;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { abbreviation: { contains: q } },
        { description: { contains: q } }
      ];
    }

    const units = await this.prisma.sellingUnit.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    return units.map((u) => ({
      ...u,
      id: u.id.toString()
    }));
  }

  async createSellingUnit(
    data: {
      name: string;
      abbreviation: string;
      unitType?: string;
      allowDecimals?: boolean;
      description?: string;
      isActive?: boolean;
    },
    userId?: string
  ) {
    const cleanName = data.name.trim();
    const existing = await this.prisma.sellingUnit.findUnique({
      where: { name: cleanName }
    });
    if (existing) {
      throw new ConflictException(`Selling unit "${cleanName}" already exists`);
    }

    const created = await this.prisma.sellingUnit.create({
      data: {
        name: cleanName,
        abbreviation: data.abbreviation.trim(),
        unitType: data.unitType?.trim() || 'COUNT',
        allowDecimals: Boolean(data.allowDecimals),
        description: data.description?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });

    await this.auditLogsService.log({
      userId,
      action: 'SELLING_UNIT_CREATE',
      entityType: 'SELLING_UNIT',
      entityId: created.id.toString(),
      afterData: { name: created.name, abbr: created.abbreviation }
    });

    return { ...created, id: created.id.toString() };
  }

  async updateSellingUnit(
    id: string,
    data: {
      name?: string;
      abbreviation?: string;
      unitType?: string;
      allowDecimals?: boolean;
      description?: string;
      isActive?: boolean;
    },
    userId?: string
  ) {
    const unit = await this.prisma.sellingUnit.findUnique({ where: { id: BigInt(id) } });
    if (!unit) throw new NotFoundException(`Selling Unit not found`);

    if (data.name && data.name.trim() !== unit.name) {
      const duplicate = await this.prisma.sellingUnit.findUnique({
        where: { name: data.name.trim() }
      });
      if (duplicate && duplicate.id !== unit.id) {
        throw new ConflictException(`Selling unit "${data.name}" already exists`);
      }
    }

    const updated = await this.prisma.sellingUnit.update({
      where: { id: unit.id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.abbreviation ? { abbreviation: data.abbreviation.trim() } : {}),
        ...(data.unitType ? { unitType: data.unitType.trim() } : {}),
        ...(data.allowDecimals !== undefined ? { allowDecimals: data.allowDecimals } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
      }
    });

    return { ...updated, id: updated.id.toString() };
  }

  async toggleSellingUnitActive(id: string, userId?: string) {
    const unit = await this.prisma.sellingUnit.findUnique({ where: { id: BigInt(id) } });
    if (!unit) throw new NotFoundException(`Selling Unit not found`);

    const updated = await this.prisma.sellingUnit.update({
      where: { id: unit.id },
      data: { isActive: !unit.isActive }
    });

    return { ...updated, id: updated.id.toString() };
  }

  async deleteSellingUnit(id: string, userId?: string) {
    const unit = await this.prisma.sellingUnit.findUnique({
      where: { id: BigInt(id) },
      include: {
        conversions: { take: 1 }
      }
    });
    if (!unit) throw new NotFoundException(`Selling Unit not found`);

    if (unit.conversions.length > 0) {
      throw new BadRequestException(
        `Cannot delete Selling Unit "${unit.name}" because it is referenced in medicine pack conversions. Please deactivate it instead.`
      );
    }

    await this.prisma.sellingUnit.delete({ where: { id: unit.id } });
    return { success: true, message: `Selling unit "${unit.name}" deleted successfully` };
  }

  // =========================================================================
  // 5. PURCHASE UNITS
  // =========================================================================

  async getPurchaseUnits(search?: string, isActive?: boolean) {
    const where: Prisma.PurchaseUnitWhereInput = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { abbreviation: { contains: q } },
        { description: { contains: q } }
      ];
    }

    const units = await this.prisma.purchaseUnit.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    return units.map((u) => ({
      ...u,
      id: u.id.toString()
    }));
  }

  async createPurchaseUnit(
    data: { name: string; abbreviation: string; description?: string; isActive?: boolean },
    userId?: string
  ) {
    const cleanName = data.name.trim();
    const existing = await this.prisma.purchaseUnit.findUnique({
      where: { name: cleanName }
    });
    if (existing) {
      throw new ConflictException(`Purchase unit "${cleanName}" already exists`);
    }

    const created = await this.prisma.purchaseUnit.create({
      data: {
        name: cleanName,
        abbreviation: data.abbreviation.trim(),
        description: data.description?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });

    await this.auditLogsService.log({
      userId,
      action: 'PURCHASE_UNIT_CREATE',
      entityType: 'PURCHASE_UNIT',
      entityId: created.id.toString(),
      afterData: { name: created.name, abbr: created.abbreviation }
    });

    return { ...created, id: created.id.toString() };
  }

  async updatePurchaseUnit(
    id: string,
    data: { name?: string; abbreviation?: string; description?: string; isActive?: boolean },
    userId?: string
  ) {
    const unit = await this.prisma.purchaseUnit.findUnique({ where: { id: BigInt(id) } });
    if (!unit) throw new NotFoundException(`Purchase Unit not found`);

    if (data.name && data.name.trim() !== unit.name) {
      const duplicate = await this.prisma.purchaseUnit.findUnique({
        where: { name: data.name.trim() }
      });
      if (duplicate && duplicate.id !== unit.id) {
        throw new ConflictException(`Purchase unit "${data.name}" already exists`);
      }
    }

    const updated = await this.prisma.purchaseUnit.update({
      where: { id: unit.id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.abbreviation ? { abbreviation: data.abbreviation.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
      }
    });

    return { ...updated, id: updated.id.toString() };
  }

  async togglePurchaseUnitActive(id: string, userId?: string) {
    const unit = await this.prisma.purchaseUnit.findUnique({ where: { id: BigInt(id) } });
    if (!unit) throw new NotFoundException(`Purchase Unit not found`);

    const updated = await this.prisma.purchaseUnit.update({
      where: { id: unit.id },
      data: { isActive: !unit.isActive }
    });

    return { ...updated, id: updated.id.toString() };
  }

  async deletePurchaseUnit(id: string, userId?: string) {
    const unit = await this.prisma.purchaseUnit.findUnique({
      where: { id: BigInt(id) },
      include: {
        conversions: { take: 1 }
      }
    });
    if (!unit) throw new NotFoundException(`Purchase Unit not found`);

    if (unit.conversions.length > 0) {
      throw new BadRequestException(
        `Cannot delete Purchase Unit "${unit.name}" because it is referenced in medicine pack conversions. Please deactivate it instead.`
      );
    }

    await this.prisma.purchaseUnit.delete({ where: { id: unit.id } });
    return { success: true, message: `Purchase unit "${unit.name}" deleted successfully` };
  }

  // =========================================================================
  // 6. MEDICINE PACKAGING & UNIT CONVERSIONS
  // =========================================================================

  async getMedicinePackaging(medicineId: string) {
    const packagings = await this.prisma.medicinePackaging.findMany({
      where: { medicineId: BigInt(medicineId) },
      include: {
        purchaseUnit: true,
        sellingUnit: true
      },
      orderBy: { isDefault: 'desc' }
    });

    return packagings.map((p) => ({
      ...p,
      id: p.id.toString(),
      medicineId: p.medicineId.toString(),
      purchaseUnitId: p.purchaseUnitId?.toString() || null,
      sellingUnitId: p.sellingUnitId?.toString() || null,
      conversionFactor: Number(p.conversionFactor)
    }));
  }

  async saveMedicinePackaging(
    medicineId: string,
    data: {
      purchaseUnitName: string;
      packSize: string;
      conversionFactor: number;
      baseUnitName: string;
      sellingUnitName?: string;
      isDefault?: boolean;
      notes?: string;
    }
  ) {
    if (data.conversionFactor <= 0) {
      throw new BadRequestException('Conversion factor must be greater than zero');
    }

    const med = await this.prisma.medicine.findUnique({ where: { id: BigInt(medicineId) } });
    if (!med) throw new NotFoundException('Medicine not found');

    // Find purchase unit and selling unit records if matching
    const pUnit = await this.prisma.purchaseUnit.findFirst({
      where: { name: data.purchaseUnitName.trim() }
    });
    const sUnit = data.sellingUnitName
      ? await this.prisma.sellingUnit.findFirst({
          where: { name: data.sellingUnitName.trim() }
        })
      : null;

    const created = await this.prisma.medicinePackaging.create({
      data: {
        medicineId: med.id,
        purchaseUnitId: pUnit?.id || null,
        purchaseUnitName: data.purchaseUnitName.trim(),
        packSize: data.packSize.trim(),
        conversionFactor: new Prisma.Decimal(data.conversionFactor),
        baseUnitName: data.baseUnitName.trim(),
        sellingUnitId: sUnit?.id || null,
        sellingUnitName: data.sellingUnitName?.trim() || data.baseUnitName.trim(),
        isDefault: data.isDefault !== undefined ? data.isDefault : true,
        notes: data.notes?.trim() || null
      }
    });

    // Update medicine packSize and purchaseUnit default
    await this.prisma.medicine.update({
      where: { id: med.id },
      data: {
        packSize: data.packSize.trim(),
        purchaseUnit: data.purchaseUnitName.trim()
      }
    });

    return {
      ...created,
      id: created.id.toString(),
      medicineId: created.medicineId.toString(),
      conversionFactor: Number(created.conversionFactor)
    };
  }

  async deleteMedicinePackaging(packagingId: string) {
    await this.prisma.medicinePackaging.delete({
      where: { id: BigInt(packagingId) }
    });
    return { success: true, message: 'Packaging conversion deleted' };
  }

  // =========================================================================
  // 7. COMPREHENSIVE METADATA AGGREGATOR
  // =========================================================================

  async getAllMasterMeta() {
    const [categories, subcategories, dosageForms, sellingUnits, purchaseUnits] =
      await Promise.all([
        this.prisma.category.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, code: true, description: true }
        }),
        this.prisma.subCategory.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, categoryId: true, name: true, code: true }
        }),
        this.prisma.dosageFormMaster.findMany({
          where: { isActive: true },
          orderBy: [{ categoryGroup: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, categoryGroup: true }
        }),
        this.prisma.sellingUnit.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            abbreviation: true,
            unitType: true,
            allowDecimals: true
          }
        }),
        this.prisma.purchaseUnit.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, abbreviation: true }
        })
      ]);

    // Extract unique dosage form groups
    const groupsSet = new Set<string>();
    dosageForms.forEach((df) => groupsSet.add(df.categoryGroup));

    return {
      categories: categories.map((c) => ({ ...c, id: c.id.toString() })),
      subcategories: subcategories.map((s) => ({
        ...s,
        id: s.id.toString(),
        categoryId: s.categoryId.toString()
      })),
      dosageForms: dosageForms.map((df) => ({ ...df, id: df.id.toString() })),
      dosageFormGroups: Array.from(groupsSet),
      sellingUnits: sellingUnits.map((su) => ({ ...su, id: su.id.toString() })),
      purchaseUnits: purchaseUnits.map((pu) => ({ ...pu, id: pu.id.toString() }))
    };
  }
}

