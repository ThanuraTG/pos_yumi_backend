import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MedicinesModule } from './medicines/medicines.module';
import { BatchesModule } from './batches/batches.module';
import { SalesModule } from './sales/sales.module';
import { PurchasesModule } from './purchases/purchases.module';
import { CashSessionsModule } from './cash-sessions/cash-sessions.module';
import { CustomersModule } from './customers/customers.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReportsModule } from './reports/reports.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { SettingsModule } from './settings/settings.module';
import { ExpensesModule } from './expenses/expenses.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UsersModule } from './users/users.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: process.env.THROTTLE_TTL ? Number(process.env.THROTTLE_TTL) : 60000,
        limit: process.env.THROTTLE_LIMIT ? Number(process.env.THROTTLE_LIMIT) : 100
      }
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    MedicinesModule,
    BatchesModule,
    SalesModule,
    PurchasesModule,
    CashSessionsModule,
    CustomersModule,
    InventoryModule,
    ReportsModule,
    SuppliersModule,
    PrescriptionsModule,
    ExpensesModule,
    NotificationsModule,
    SettingsModule,
    AuditLogsModule
  ],
  controllers: [AppController]
})
export class AppModule {}
