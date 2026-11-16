import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
  IsBoolean
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class SaleItemInputDto {
  @IsNotEmpty()
  @IsString()
  batchId: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}

export class PaymentInputDto {
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  referenceCode?: string;
}

export class CreateSaleDto {
  @IsNotEmpty()
  @IsString()
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  offlineCreatedAt?: string;

  @IsOptional()
  @IsBoolean()
  isOfflineSync?: boolean;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  prescriptionId?: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items: SaleItemInputDto[];

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentInputDto)
  payments: PaymentInputDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amountPaid: number;
}

