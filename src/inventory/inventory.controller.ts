import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MovementType, AdjustmentStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermissions('inventory.view_ledger')
  async getOverview() {
    return await this.inventoryService.getOverview();
  }

  @Get('movements')
  @RequirePermissions('inventory.view_ledger')
  async getMovements(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('batchId') batchId?: string,
    @Query('movementType') movementType?: MovementType
  ) {
    return await this.inventoryService.getMovements(+page, +limit, batchId, movementType);
  }

  @Get('adjustments')
  @RequirePermissions('inventory.view_ledger')
  async getAdjustments(@Query('status') status?: AdjustmentStatus) {
    return await this.inventoryService.getAdjustments(status);
  }

  @Post('adjustments')
  @RequirePermissions('inventory.adjust')
  async createAdjustment(
    @CurrentUser('sub') userId: string,
    @Body() body: any
  ) {
    return await this.inventoryService.createAdjustment(userId, body);
  }

  @Patch('adjustments/:id/approve')
  @RequirePermissions('inventory.approve_adjustment')
  async approveAdjustment(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string
  ) {
    return await this.inventoryService.approveAdjustment(id, userId);
  }
}

