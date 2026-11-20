import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Request, Response } from 'express';
import { NotificationsService } from './notifications.service';
import { SendWhatsappReminderDto } from './dto/send-reminder.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Public } from '../common/decorators/public.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Meta WhatsApp Webhook GET Verification
   * Meta sends hub.mode, hub.verify_token, and hub.challenge
   */
  @Public()
  @Get('whatsapp/webhook')
  verifyWebhook(@Req() req: Request, @Res() res: Response) {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    try {
      const verifiedChallenge = this.notificationsService.verifyWebhook(mode, token, challenge);
      // Meta requires HTTP 200 with raw plain text challenge
      return res.status(HttpStatus.OK).type('text/plain').send(verifiedChallenge);
    } catch (err: any) {
      this.logger.warn(`WhatsApp Webhook verification failed for token: ${token}`);
      return res.status(HttpStatus.FORBIDDEN).type('text/plain').send('Forbidden: Token mismatch');
    }
  }

  /**
   * Meta WhatsApp Webhook POST Event Receiver
   * Handles delivery receipts, read statuses, and incoming replies
   */
  @Public()
  @Post('whatsapp/webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: any, @Res() res: Response) {
    // Immediately return 200 OK to acknowledge receipt to Meta
    res.status(HttpStatus.OK).type('text/plain').send('EVENT_RECEIVED');

    // Process event asynchronously
    try {
      await this.notificationsService.processWhatsAppWebhook(body);
    } catch (err: any) {
      this.logger.error(`Error processing WhatsApp webhook: ${err.message}`, err.stack);
    }
  }

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

