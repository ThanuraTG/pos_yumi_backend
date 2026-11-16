import { IsString, IsNotEmpty, IsOptional, IsEmail, IsNumber, Min, IsEnum } from 'class-validator';
import { SupplierPayMethod } from '@prisma/client';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  contactPerson?: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  creditLimit?: number;
}

export class RecordSupplierPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(SupplierPayMethod)
  paymentMethod: SupplierPayMethod;

  @IsString()
  @IsOptional()
  paymentReference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
