import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { BatchStatus } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('batches')
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get()
  @RequirePermissions('batches.view')
  async findAll(
    @Query('medicineId') medicineId?: string,
    @Query('status') status?: BatchStatus,
    @Query('expiringDays') expiringDays?: string
  ) {
    return await this.batchesService.findAll(medicineId, status, expiringDays ? +expiringDays : undefined);
  }

  @Get('expiring')
  @RequirePermissions('batches.view')
  async getExpiring(@Query('days') days = '60') {
    return await this.batchesService.findAll(undefined, undefined, +days);
  }

  @Get('fefo/:medicineId')
  @RequirePermissions('sales.create')
  async getFefoBatches(@Param('medicineId') medicineId: string) {
    return await this.batchesService.getFefoBatches(medicineId);
  }

  @Get('allocate-fefo/:medicineId')
  @RequirePermissions('sales.create')
  async allocateFefo(
    @Param('medicineId') medicineId: string,
    @Query('quantity') quantity = '1'
  ) {
    return await this.batchesService.allocateFefo(medicineId, parseFloat(quantity) || 1);
  }

  @Post()
  @RequirePermissions('batches.create')
  async create(
    @Body() dto: CreateBatchDto,
    @CurrentUser('sub') userId: string
  ) {
    return await this.batchesService.create(dto, userId);
  }

  @Post('return-supplier')
  @RequirePermissions('batches.quarantine')
  async returnToSupplier(
    @Body() body: { batchId: string; quantity: number; reason: string },
    @CurrentUser('sub') userId: string
  ) {
    return await this.batchesService.returnToSupplier(body.batchId, body.quantity, body.reason, userId);
  }

  @Patch(':id/transfer-location')
  @RequirePermissions('batches.quarantine')
  async transferLocation(
    @Param('id') id: string,
    @Body('rackLocation') rackLocation: string,
    @CurrentUser('sub') userId: string
  ) {
    return await this.batchesService.transferLocation(id, rackLocation, userId);
  }

  @Patch(':id/quarantine')
  @RequirePermissions('batches.quarantine')
  async quarantine(@Param('id') id: string, @Body('reason') reason?: string) {
    return await this.batchesService.quarantineBatch(id, reason);
  }

  @Patch(':id')
  @RequirePermissions('batches.quarantine')
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser('sub') userId: string
  ) {
    return await this.batchesService.update(id, body, userId);
  }
}
