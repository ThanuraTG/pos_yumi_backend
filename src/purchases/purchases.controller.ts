import { Controller, Post, Body, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseOrderDto } from './dto/create-po.dto';
import { ReceiveGoodsDto } from './dto/receive-grn.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PurchaseStatus, SupplierPayMethod } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @RequirePermissions('purchases.receive_grn')
  async createPurchase(
    @CurrentUser('sub') userId: string,
    @Body() dto: any
  ) {
    if (dto.items && dto.items[0]?.batchNumber) {
      return await this.purchasesService.receiveGoods(userId, dto);
    }
    return await this.purchasesService.createPurchaseOrder(userId, dto);
  }

  @Post(':id/receive')
  @RequirePermissions('purchases.receive_grn')
  async receivePurchase(
    @Param('id') purchaseId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: ReceiveGoodsDto
  ) {
    dto.purchaseOrderId = purchaseId;
    return await this.purchasesService.receiveGoods(userId, dto);
  }

  @Post('orders')
  @RequirePermissions('purchases.order_create')
  async createPO(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePurchaseOrderDto
  ) {
    return await this.purchasesService.createPurchaseOrder(userId, dto);
  }

  @Patch(':id/approve')
  @RequirePermissions('purchases.order_create')
  async approvePO(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string
  ) {
    return await this.purchasesService.approvePO(id, userId);
  }

  @Patch(':id/cancel')
  @RequirePermissions('purchases.order_create')
  async cancelPO(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string
  ) {
    return await this.purchasesService.cancelPO(id, userId);
  }

  @Post(':id/payments')
  @RequirePermissions('purchases.receive_grn')
  async recordPayment(
    @Param('id') purchaseId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { amount: number; paymentMethod: SupplierPayMethod; paymentReference?: string }
  ) {
    return await this.purchasesService.recordPayment(purchaseId, userId, body);
  }

  @Post('returns')
  @RequirePermissions('purchases.receive_grn')
  async createReturn(
    @CurrentUser('sub') userId: string,
    @Body() body: any
  ) {
    return await this.purchasesService.createReturn(userId, body);
  }

  @Get('returns')
  @RequirePermissions('purchases.view')
  async findAllReturns() {
    return await this.purchasesService.findAllReturns();
  }

  @Post('grn')
  @RequirePermissions('purchases.receive_grn')
  async receiveGoods(
    @CurrentUser('sub') userId: string,
    @Body() dto: ReceiveGoodsDto
  ) {
    return await this.purchasesService.receiveGoods(userId, dto);
  }

  @Get()
  @RequirePermissions('purchases.view')
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: PurchaseStatus
  ) {
    return await this.purchasesService.findAll(+page, +limit, status);
  }
}

