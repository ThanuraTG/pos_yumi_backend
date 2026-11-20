import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Request, Response } from 'express';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Public } from '../common/decorators/public.decorator';

/**
 * Secondary Controller mapping /api/v1/whatsapp/webhook
 * Ensures both /api/v1/notifications/whatsapp/webhook and /api/v1/whatsapp/webhook work seamlessly
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('whatsapp')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Public()
  @Get('webhook')
  verifyWebhook(@Req() req: Request, @Res() res: Response) {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    try {
      const verifiedChallenge = this.notificationsService.verifyWebhook(mode, token, challenge);
      return res.status(HttpStatus.OK).type('text/plain').send(verifiedChallenge);
    } catch (err: any) {
      this.logger.warn(`WhatsApp Webhook verification failed for token: ${token}`);
      return res.status(HttpStatus.FORBIDDEN).type('text/plain').send('Forbidden: Token mismatch');
    }
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: any, @Res() res: Response) {
    res.status(HttpStatus.OK).type('text/plain').send('EVENT_RECEIVED');
    try {
      await this.notificationsService.processWhatsAppWebhook(body);
    } catch (err: any) {
      this.logger.error(`Error processing WhatsApp webhook: ${err.message}`, err.stack);
    }
  }
}
