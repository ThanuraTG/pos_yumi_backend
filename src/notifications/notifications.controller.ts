import { Controller, Get, Post, Body, Query, Param, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SendWhatsappReminderDto } from './dto/send-reminder.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermissions('customers.view')
  async getNotificationsOverview() {
    return await this.notificationsService.getLogs();
  }

  @Get('config')
  @RequirePermissions('customers.view')
  async getConfig() {
    return await this.notificationsService.getConfig();
  }

  @Get('templates')
  @RequirePermissions('customers.view')
  async getTemplates() {
    return await this.notificationsService.getTemplates();
  }

  @Get('logs')
  @RequirePermissions('customers.view')
  async getLogs(@Query('customerId') customerId?: string) {
    return await this.notificationsService.getLogs(customerId);
  }

  @Post('test')
  @RequirePermissions('settings.manage')
  async testNotification(@Body('phone') phone?: string) {
    return await this.notificationsService.sendTestNotification(phone);
  }

  @Post('whatsapp/send')
  @RequirePermissions('customers.manage')
  async sendReminder(@Body() dto: SendWhatsappReminderDto) {
    return await this.notificationsService.sendReminder(dto);
  }

  @Post('whatsapp/send-custom')
  async sendCustom(@Body() dto: { phone: string; templateName?: string; customerId?: string; customText?: string; params?: any; isTransactional?: boolean }) {
    return await this.notificationsService.sendCustomMessage(dto);
  }

  @Post('retry/:id')
  @RequirePermissions('customers.manage')
  async retryMessage(@Param('id') id: string) {
    return await this.notificationsService.retryNotification(id);
  }

  @Post('whatsapp/dispatch-schedule')
  @RequirePermissions('settings.manage')
  async dispatchSchedule(@Body('timeSlot') timeSlot: 'MORNING' | 'AFTERNOON' | 'NIGHT') {
    return await this.notificationsService.dispatchDailyReminders(timeSlot || 'MORNING');
  }
}

