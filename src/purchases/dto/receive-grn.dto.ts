import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsDateString,
  IsOptional
} from 'class-validator';
import { Type } from 'class-transformer';

export class GrnItemInputDto {
  @IsNotEmpty()
  @IsString()
  medicineId: string;

  @IsNotEmpty()
  @IsString()
  batchNumber: string;

  @IsNotEmpty()
  @IsDateString()
  expiryDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  receivedQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusQuantity?: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  unitCost: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  sellingPrice: number;
}

export class ReceiveGoodsDto {
  @IsNotEmpty()
  @IsString()
  supplierId: string;

  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @IsOptional()
  @IsString()
  supplierInvoiceNo?: string;

  @IsOptional()
  @IsString()
  invoiceReference?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountPaid?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrnItemInputDto)
  items: GrnItemInputDto[];
}

