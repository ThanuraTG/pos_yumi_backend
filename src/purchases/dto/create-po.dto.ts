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

export class PoItemInputDto {
  @IsNotEmpty()
  @IsString()
  medicineId: string;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  orderedQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedUnitCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePurchaseOrderDto {
  @IsNotEmpty()
  @IsString()
  supplierId: string;

  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PoItemInputDto)
  items: PoItemInputDto[];
}

