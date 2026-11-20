import { Controller, Get, Patch, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Public } from '../common/decorators/public.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  @Public()
  async getPublicSettings() {
    return await this.settingsService.getAllSettings();
  }

  @Get()
  async getSettings() {
    return await this.settingsService.getAllSettings();
  }

  @Patch()
  @RequirePermissions('settings.manage')
  async updateSettings(@Body() body: Record<string, string>) {
    return await this.settingsService.updateBulk(body);
  }

  @Get('security/status')
  @RequirePermissions('settings.manage')
  async getSecurityStatus() {
    return await this.settingsService.getSecurityStatus();
  }

  @Get('backups')
  @RequirePermissions('settings.manage')
  async getBackups() {
    return await this.settingsService.getBackups();
  }

  @Post('backups')
  @RequirePermissions('settings.manage')
  async createBackup(@Body() body: { type?: string }) {
    return await this.settingsService.createBackup(body?.type || 'MANUAL');
  }

  @Post('backups/:id/verify')
  @RequirePermissions('settings.manage')
  async verifyBackup(@Param('id') id: string) {
    return await this.settingsService.verifyBackup(id);
  }

  @Post('backups/:id/restore')
  @RequirePermissions('settings.manage')
  async restoreBackup(@Param('id') id: string) {
    return await this.settingsService.restoreBackup(id);
  }
}
