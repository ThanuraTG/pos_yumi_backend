import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards
} from '@nestjs/common';
import { ClassificationService } from './classification.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('medicines/classification')
export class ClassificationController {
  constructor(private readonly classificationService: ClassificationService) {}

  // -------------------------------------------------------------------------
  // Master Metadata Aggregator
  // -------------------------------------------------------------------------
  @Get('meta')
  @RequirePermissions('medicines.view')
  async getAllMasterMeta() {
    return await this.classificationService.getAllMasterMeta();
  }

  // -------------------------------------------------------------------------
  // 1. Categories
  // -------------------------------------------------------------------------
  @Get('categories')
  @RequirePermissions('medicines.view')
  async getCategories(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string
  ) {
    const activeBool = isActive !== undefined && isActive !== '' ? isActive === 'true' : undefined;
    return await this.classificationService.getCategories(search, activeBool);
  }

  @Get('categories/:id')
  @RequirePermissions('medicines.view')
  async getCategoryById(@Param('id') id: string) {
    return await this.classificationService.getCategoryById(id);
  }

  @Post('categories')
  @RequirePermissions('medicines.create')
  async createCategory(
    @Body() body: { name: string; code?: string; description?: string; imageUrl?: string; isActive?: boolean },
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.createCategory(body, userId);
  }

  @Put('categories/:id')
  @RequirePermissions('medicines.edit')
  async updateCategory(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; imageUrl?: string; isActive?: boolean },
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.updateCategory(id, body, userId);
  }

  @Patch('categories/:id/toggle')
  @RequirePermissions('medicines.edit')
  async toggleCategoryActive(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.toggleCategoryActive(id, userId);
  }

  @Delete('categories/:id')
  @RequirePermissions('medicines.delete')
  async deleteCategory(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.deleteCategory(id, userId);
  }

  // -------------------------------------------------------------------------
  // 2. Subcategories
  // -------------------------------------------------------------------------
  @Get('subcategories')
  @RequirePermissions('medicines.view')
  async getSubcategories(
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string
  ) {
    const activeBool = isActive !== undefined && isActive !== '' ? isActive === 'true' : undefined;
    return await this.classificationService.getSubcategories(categoryId, search, activeBool);
  }

  @Post('subcategories')
  @RequirePermissions('medicines.create')
  async createSubcategory(
    @Body() body: { categoryId: string; name: string; code?: string; description?: string; isActive?: boolean },
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.createSubcategory(body, userId);
  }

  @Put('subcategories/:id')
  @RequirePermissions('medicines.edit')
  async updateSubcategory(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; isActive?: boolean },
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.updateSubcategory(id, body, userId);
  }

  @Patch('subcategories/:id/toggle')
  @RequirePermissions('medicines.edit')
  async toggleSubcategoryActive(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.toggleSubcategoryActive(id, userId);
  }

  @Delete('subcategories/:id')
  @RequirePermissions('medicines.delete')
  async deleteSubcategory(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.deleteSubcategory(id, userId);
  }

  // -------------------------------------------------------------------------
  // 3. Dosage Forms
  // -------------------------------------------------------------------------
  @Get('dosage-forms')
  @RequirePermissions('medicines.view')
  async getDosageForms(
    @Query('group') group?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string
  ) {
    const activeBool = isActive !== undefined && isActive !== '' ? isActive === 'true' : undefined;
    return await this.classificationService.getDosageForms(group, search, activeBool);
  }

  @Post('dosage-forms')
  @RequirePermissions('medicines.create')
  async createDosageForm(
    @Body() body: { name: string; categoryGroup: string; description?: string; isActive?: boolean },
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.createDosageForm(body, userId);
  }

  @Put('dosage-forms/:id')
  @RequirePermissions('medicines.edit')
  async updateDosageForm(
    @Param('id') id: string,
    @Body() body: { name?: string; categoryGroup?: string; description?: string; isActive?: boolean },
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.updateDosageForm(id, body, userId);
  }

  @Patch('dosage-forms/:id/toggle')
  @RequirePermissions('medicines.edit')
  async toggleDosageFormActive(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.toggleDosageFormActive(id, userId);
  }

  @Delete('dosage-forms/:id')
  @RequirePermissions('medicines.delete')
  async deleteDosageForm(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.deleteDosageForm(id, userId);
  }

  // -------------------------------------------------------------------------
  // 4. Selling Units
  // -------------------------------------------------------------------------
  @Get('units/selling')
  @RequirePermissions('medicines.view')
  async getSellingUnits(
    @Query('search') search?: string,
    @Query('type') unitType?: string,
    @Query('isActive') isActive?: string
  ) {
    const activeBool = isActive !== undefined && isActive !== '' ? isActive === 'true' : undefined;
    return await this.classificationService.getSellingUnits(search, unitType, activeBool);
  }

  @Post('units/selling')
  @RequirePermissions('medicines.create')
  async createSellingUnit(
    @Body() body: {
      name: string;
      abbreviation: string;
      unitType?: string;
      allowDecimals?: boolean;
      description?: string;
      isActive?: boolean;
    },
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.createSellingUnit(body, userId);
  }

  @Put('units/selling/:id')
  @RequirePermissions('medicines.edit')
  async updateSellingUnit(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      abbreviation?: string;
      unitType?: string;
      allowDecimals?: boolean;
      description?: string;
      isActive?: boolean;
    },
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.updateSellingUnit(id, body, userId);
  }

  @Patch('units/selling/:id/toggle')
  @RequirePermissions('medicines.edit')
  async toggleSellingUnitActive(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.toggleSellingUnitActive(id, userId);
  }

  @Delete('units/selling/:id')
  @RequirePermissions('medicines.delete')
  async deleteSellingUnit(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.deleteSellingUnit(id, userId);
  }

  // -------------------------------------------------------------------------
  // 5. Purchase Units
  // -------------------------------------------------------------------------
  @Get('units/purchase')
  @RequirePermissions('medicines.view')
  async getPurchaseUnits(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string
  ) {
    const activeBool = isActive !== undefined && isActive !== '' ? isActive === 'true' : undefined;
    return await this.classificationService.getPurchaseUnits(search, activeBool);
  }

  @Post('units/purchase')
  @RequirePermissions('medicines.create')
  async createPurchaseUnit(
    @Body() body: { name: string; abbreviation: string; description?: string; isActive?: boolean },
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.createPurchaseUnit(body, userId);
  }

  @Put('units/purchase/:id')
  @RequirePermissions('medicines.edit')
  async updatePurchaseUnit(
    @Param('id') id: string,
    @Body() body: { name?: string; abbreviation?: string; description?: string; isActive?: boolean },
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.updatePurchaseUnit(id, body, userId);
  }

  @Patch('units/purchase/:id/toggle')
  @RequirePermissions('medicines.edit')
  async togglePurchaseUnitActive(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.togglePurchaseUnitActive(id, userId);
  }

  @Delete('units/purchase/:id')
  @RequirePermissions('medicines.delete')
  async deletePurchaseUnit(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string
  ) {
    return await this.classificationService.deletePurchaseUnit(id, userId);
  }

  // -------------------------------------------------------------------------
  // 6. Medicine Packaging & Conversion Rules
  // -------------------------------------------------------------------------
  @Get('packaging/:medicineId')
  @RequirePermissions('medicines.view')
  async getMedicinePackaging(@Param('medicineId') medicineId: string) {
    return await this.classificationService.getMedicinePackaging(medicineId);
  }

  @Post('packaging/:medicineId')
  @RequirePermissions('medicines.edit')
  async saveMedicinePackaging(
    @Param('medicineId') medicineId: string,
    @Body() body: {
      purchaseUnitName: string;
      packSize: string;
      conversionFactor: number;
      baseUnitName: string;
      sellingUnitName?: string;
      isDefault?: boolean;
      notes?: string;
    }
  ) {
    return await this.classificationService.saveMedicinePackaging(medicineId, body);
  }

  @Delete('packaging/item/:id')
  @RequirePermissions('medicines.edit')
  async deleteMedicinePackaging(@Param('id') id: string) {
    return await this.classificationService.deleteMedicinePackaging(id);
  }
}

