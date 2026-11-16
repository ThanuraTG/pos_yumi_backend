import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, RecordSupplierPaymentDto } from './dto/create-supplier.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @RequirePermissions('suppliers.view')
  async findAll(@Query('search') search?: string) {
    return await this.suppliersService.findAll(search);
  }

  @Get(':id')
  @RequirePermissions('suppliers.view')
  async findOne(@Param('id') id: string) {
    return await this.suppliersService.findOne(id);
  }

  @Post()
  @RequirePermissions('suppliers.manage')
  async create(@Body() dto: CreateSupplierDto) {
    return await this.suppliersService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('suppliers.manage')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateSupplierDto>) {
    return await this.suppliersService.update(id, dto);
  }

  @Post(':id/payments')
  @RequirePermissions('suppliers.manage')
  async recordPayment(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: RecordSupplierPaymentDto
  ) {
    return await this.suppliersService.recordPayment(id, userId, dto);
  }
}

