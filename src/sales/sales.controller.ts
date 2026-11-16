import { Controller, Post, Body, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { CreateSalesReturnDto } from './dto/sales-return.dto';
import { SyncOfflineSalesDto } from './dto/sync-offline.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SaleStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @RequirePermissions('sales.create')
  async createSale(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSaleDto
  ) {
    return await this.salesService.checkout(userId, dto);
  }

  @Post('checkout')
  @RequirePermissions('sales.create')
  async checkout(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSaleDto
  ) {
    return await this.salesService.checkout(userId, dto);
  }

  @Post('sync-offline')
  @RequirePermissions('sales.create')
  async syncOffline(
    @CurrentUser('sub') userId: string,
    @Body() dto: SyncOfflineSalesDto
  ) {
    return await this.salesService.syncOfflineSales(userId, dto);
  }

  @Post('returns')
  @RequirePermissions('sales.refund')
  async processReturn(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSalesReturnDto
  ) {
    return await this.salesService.processReturn(userId, dto);
  }

  @Post(':id/returns')
  @RequirePermissions('sales.refund')
  async processSaleReturn(
    @Param('id') saleId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSalesReturnDto
  ) {
    dto.saleId = saleId;
    return await this.salesService.processReturn(userId, dto);
  }

  @Get('returns')
  @RequirePermissions('sales.view_all')
  async getReturns() {
    return await this.salesService.getReturns();
  }

  @Get()
  @RequirePermissions('sales.view_all')
  async findSales(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('cashierId') cashierId?: string,
    @Query('status') status?: SaleStatus,
    @Query('search') search?: string
  ) {
    return await this.salesService.findAll(+page, +limit, cashierId, status, search);
  }

  @Get('invoices')
  @RequirePermissions('sales.view_all')
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('cashierId') cashierId?: string,
    @Query('status') status?: SaleStatus,
    @Query('search') search?: string
  ) {
    return await this.salesService.findAll(+page, +limit, cashierId, status, search);
  }

  @Get(':id')
  @RequirePermissions('sales.view_all')
  async getSaleById(@Param('id') id: string) {
    return await this.salesService.findOne(id);
  }

  @Get('invoices/:id')
  @RequirePermissions('sales.view_all')
  async findOne(@Param('id') id: string) {
    return await this.salesService.findOne(id);
  }

  @Post(':id/void')
  @RequirePermissions('sales.refund')
  async voidSale(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body('reason') reason?: string
  ) {
    return await this.salesService.voidSale(id, userId, reason);
  }

  @Get(':id/payments')
  @RequirePermissions('sales.view_all')
  async getPayments(@Param('id') id: string) {
    return await this.salesService.getPayments(id);
  }

  @Post(':id/payments')
  @RequirePermissions('sales.create')
  async recordPayment(
    @Param('id') id: string,
    @Body() body: { method: any; amount: number; referenceCode?: string }
  ) {
    return await this.salesService.recordPayment(id, body.method, body.amount, body.referenceCode);
  }

  @Post('invoices/:id/reprint')
  @RequirePermissions('sales.reprint_receipt')
  async logReprint(@Param('id') id: string) {
    return await this.salesService.logReprint(id);
  }
}

