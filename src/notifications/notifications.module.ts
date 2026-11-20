import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';

@Module({
  controllers: [NotificationsController, WhatsappWebhookController],
  providers: [NotificationsService],
  exports: [NotificationsService]
})
export class NotificationsModule {}

