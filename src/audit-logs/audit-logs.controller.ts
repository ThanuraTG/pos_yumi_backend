import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @RequirePermissions('settings.manage')
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('entityType') entityType?: string,
    @Query('action') action?: string
  ) {
    return await this.auditLogsService.findAll(+page, +limit, entityType, action);
  }
}

