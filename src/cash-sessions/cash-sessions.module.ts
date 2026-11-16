import { Module } from '@nestjs/common';
import { CashSessionsService } from './cash-sessions.service';
import { CashSessionsController } from './cash-sessions.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CashSessionsController],
  providers: [CashSessionsService],
  exports: [CashSessionsService]
})
export class CashSessionsModule {}

