import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsEnum
} from 'class-validator';
import { Type } from 'class-transformer';
import { RestockStatus, RefundMethod } from '@prisma/client';

export class ReturnItemInputDto {
  @IsNotEmpty()
  @IsString()
  saleItemId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.001)
  returnQuantity: number;

  @IsNotEmpty()
  @IsEnum(RestockStatus)
  restockStatus: RestockStatus;
}

export class CreateSalesReturnDto {
  @IsNotEmpty()
  @IsString()
  saleId: string;

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsNotEmpty()
  @IsEnum(RefundMethod)
  refundMethod: RefundMethod;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInputDto)
  items: ReturnItemInputDto[];
}

