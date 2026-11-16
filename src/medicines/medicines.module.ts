import { Module } from '@nestjs/common';
import { MedicinesService } from './medicines.service';
import { MedicinesController } from './medicines.controller';
import { ClassificationService } from './classification.service';
import { ClassificationController } from './classification.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuthModule, AuditLogsModule],
  controllers: [MedicinesController, ClassificationController],
  providers: [MedicinesService, ClassificationService],
  exports: [MedicinesService, ClassificationService]
})
export class MedicinesModule {}

