import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto, UpdatePrescriptionStatusDto } from './dto/create-prescription.dto';
import { PrescriptionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Get()
  @RequirePermissions('prescriptions.intake')
  async findAll(
    @Query('search') search?: string,
    @Query('status') status?: PrescriptionStatus
  ) {
    return await this.prescriptionsService.findAll(search, status);
  }

  @Get(':id')
  @RequirePermissions('prescriptions.intake')
  async findOne(@Param('id') id: string) {
    return await this.prescriptionsService.findOne(id);
  }

  @Post()
  @RequirePermissions('prescriptions.intake')
  async create(@Body() dto: CreatePrescriptionDto) {
    return await this.prescriptionsService.create(dto);
  }

  @Patch(':id/verify')
  @RequirePermissions('prescriptions.verify')
  async verify(@Param('id') id: string) {
    return await this.prescriptionsService.verify(id);
  }

  @Patch(':id/status')
  @RequirePermissions('prescriptions.verify')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePrescriptionStatusDto
  ) {
    return await this.prescriptionsService.updateStatus(id, dto);
  }
}

