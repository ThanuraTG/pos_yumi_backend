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

  @IsNotEmpty()
  @IsNumber()
  @Min(0.001)
  orderedQuantity: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  estimatedUnitCost: number;
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

