import { IsNotEmpty, IsString, IsDateString, IsNumber, Min, IsOptional } from 'class-validator';

export class CreateBatchDto {
  @IsNotEmpty()
  @IsString()
  medicineId: string;

  @IsNotEmpty()
  @IsString()
  batchNumber: string;

  @IsOptional()
  @IsDateString()
  mfgDate?: string;

  @IsNotEmpty()
  @IsDateString()
  expiryDate: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  costPrice: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  sellingPrice: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  quantityOnHand: number;

  @IsOptional()
  @IsString()
  rackLocation?: string;
}

