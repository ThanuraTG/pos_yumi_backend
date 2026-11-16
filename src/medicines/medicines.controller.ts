import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards
} from '@nestjs/common';
import { MedicinesService } from './medicines.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('medicines')
export class MedicinesController {
  constructor(private readonly medicinesService: MedicinesService) {}

  @Get()
  @RequirePermissions('medicines.view')
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandName') brandName?: string,
    @Query('manufacturerId') manufacturerId?: string,
    @Query('stockStatus') stockStatus?: string,
    @Query('expiryStatus') expiryStatus?: string,
    @Query('isActive') isActive?: string,
    @Query('sortBy') sortBy = 'brandName',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'asc',
    @Query('dosageForm') dosageForm?: string,
    @Query('prescriptionType') prescriptionType?: string
  ) {
    return await this.medicinesService.findAll(
      +page,
      +limit,
      search,
      categoryId,
      brandName,
      manufacturerId,
      stockStatus,
      expiryStatus,
      isActive,
      sortBy,
      sortOrder,
      dosageForm,
      prescriptionType
    );
  }

  @Get('generate-sku')
  @RequirePermissions('medicines.create')
  async generateSku() {
    const sku = await this.medicinesService.generateSkuCode();
    return { skuCode: sku };
  }

  @Get('search')
  @RequirePermissions('medicines.view')
  async searchMedicines(@Query('q') query: string) {
    return await this.medicinesService.searchForPos(query || '');
  }

  @Get('search/pos')
  @RequirePermissions('sales.create')
  async searchForPos(@Query('q') query: string) {
    return await this.medicinesService.searchForPos(query);
  }

  @Get('meta/categories')
  @RequirePermissions('medicines.view')
  async getCategories() {
    return await this.medicinesService.getCategories();
  }

  @Get('meta/generics')
  @RequirePermissions('medicines.view')
  async getGenerics() {
    return await this.medicinesService.getGenerics();
  }

  @Post('meta/generics')
  @RequirePermissions('medicines.create')
  async createGeneric(@Body() body: { name: string; therapeuticClass?: string; notes?: string }) {
    return await this.medicinesService.createGeneric(body);
  }

  @Patch('meta/generics/:id')
  @RequirePermissions('medicines.edit')
  async updateGeneric(
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; therapeuticClass?: string; notes?: string }>
  ) {
    return await this.medicinesService.updateGeneric(id, body);
  }

  @Delete('meta/generics/:id')
  @RequirePermissions('medicines.delete')
  async deleteGeneric(@Param('id') id: string) {
    return await this.medicinesService.deleteGeneric(id);
  }

  @Get('meta/manufacturers')
  @RequirePermissions('medicines.view')
  async getManufacturers() {
    return await this.medicinesService.getManufacturers();
  }

  @Post('meta/manufacturers')
  @RequirePermissions('medicines.create')
  async createManufacturer(@Body() body: { name: string; country?: string; contactPhone?: string }) {
    return await this.medicinesService.createManufacturer(body);
  }

  @Patch('meta/manufacturers/:id')
  @RequirePermissions('medicines.edit')
  async updateManufacturer(
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; country?: string; contactPhone?: string; isActive?: boolean }>
  ) {
    return await this.medicinesService.updateManufacturer(id, body);
  }

  @Delete('meta/manufacturers/:id')
  @RequirePermissions('medicines.delete')
  async deleteManufacturer(@Param('id') id: string) {
    return await this.medicinesService.deleteManufacturer(id);
  }

  @Get('meta/brands')
  @RequirePermissions('medicines.view')
  async getBrands() {
    return await this.medicinesService.getBrands();
  }

  @Get('meta/suppliers')
  @RequirePermissions('medicines.view')
  async getSuppliers() {
    return await this.medicinesService.getSuppliers();
  }

  @Post('bulk-import')
  @RequirePermissions('medicines.create')
  async bulkImport(@Body() body: { items: any[] }, @CurrentUser('id') userId?: string) {
    return await this.medicinesService.bulkImport(body.items, userId);
  }

  @Get(':id/batches')
  @RequirePermissions('medicines.view')
  async getBatches(@Param('id') id: string) {
    return await this.medicinesService.getBatches(id);
  }

  @Get(':id/stock-history')
  @RequirePermissions('medicines.view')
  async getStockHistory(@Param('id') id: string) {
    return await this.medicinesService.getStockHistory(id);
  }

  @Get(':id')
  @RequirePermissions('medicines.view')
  async findOne(@Param('id') id: string) {
    return await this.medicinesService.findOne(id);
  }

  @Post()
  @RequirePermissions('medicines.create')
  async create(@Body() dto: CreateMedicineDto, @CurrentUser('id') userId?: string) {
    return await this.medicinesService.create(dto, userId);
  }

  @Patch(':id')
  @RequirePermissions('medicines.edit')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateMedicineDto>,
    @CurrentUser('id') userId?: string
  ) {
    return await this.medicinesService.update(id, dto, userId);
  }

  @Patch(':id/toggle-active')
  @RequirePermissions('medicines.edit')
  async toggleActive(@Param('id') id: string, @CurrentUser('id') userId?: string) {
    return await this.medicinesService.toggleActive(id, userId);
  }

  @Delete(':id')
  @RequirePermissions('medicines.delete')
  async remove(@Param('id') id: string, @CurrentUser('id') userId?: string) {
    return await this.medicinesService.softDelete(id, userId);
  }
}
