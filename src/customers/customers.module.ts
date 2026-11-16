import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomerIdService } from './customer-id.service';
import { CustomersController } from './customers.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerIdService],
  exports: [CustomersService, CustomerIdService]
})
export class CustomersModule {}

