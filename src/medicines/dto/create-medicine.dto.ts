import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { DosageForm } from '@prisma/client';

export class MedicineUnitDto {
  @IsNotEmpty()
  @IsString()
  unitName: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.001)
  baseUnitFactor: number;

  @IsOptional()
  @IsString()
  barcode?: string;
}

export class CreateMedicineDto {
  // -----------------------------------------------------------
  // Section 1: Basic Information
  // -----------------------------------------------------------
  @IsNotEmpty()
  @IsString()
  name: string; // Medicine Chemical / Generic Name

  @IsNotEmpty()
  @IsString()
  brandName: string; // Brand Commercial Name

  @IsOptional()
  @IsString()
  skuCode?: string; // Auto-generated if not provided

  @IsOptional()
  @IsString()
  barcode?: string; // Optional unique EAN-13 / Code 128 barcode

  @IsNotEmpty()
  @IsString()
  categoryId: string; // Therapeutic category ID

  @IsOptional()
  @IsString()
  subCategory?: string;

  @IsOptional()
  @IsString()
  subCategoryId?: string;

  @IsOptional()
  @IsString()
  dosageFormId?: string;

  @IsOptional()
  @IsString()
  purchaseUnit?: string;

  @IsOptional()
  @IsNumber()
  conversionFactor?: number;

  @IsOptional()
  @IsString()
  sellingUnit?: string;

  @IsOptional()
  @IsString()
  manufacturerId?: string;

  @IsOptional()
  @IsString()
  genericId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // -----------------------------------------------------------
  // Section 2: Medicine Specifications
  // -----------------------------------------------------------
  @IsNotEmpty()
  @IsString()
  strength: string; // e.g. 500mg, 10mg/5ml

  @IsNotEmpty()
  @IsString()
  dosageForm: string;

  @IsOptional()
  @IsString()
  composition?: string; // Active ingredients list

  @IsOptional()
  @IsString()
  packSize?: string; // e.g. 10 Tablets, 100ml

  @IsOptional()
  @IsString()
  baseUnit?: string; // TABLET, CAPSULE, BOTTLE, TUBE, etc.

  @IsOptional()
  @IsString()
  route?: string; // Oral, Topical, Inhalation, etc.

  @IsOptional()
  @IsString()
  storageCondition?: string; // e.g. Store below 25°C

  @IsOptional()
  @IsBoolean()
  prescriptionRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isNarcotic?: boolean;

  // -----------------------------------------------------------
  // Section 3: Pricing Information
  // -----------------------------------------------------------
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  wholesalePrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mrp?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercentage?: number;

  // -----------------------------------------------------------
  // Section 4: Batch & Initial Stock Information
  // -----------------------------------------------------------
  @IsOptional()
  @IsString()
  initialBatchNumber?: string;

  @IsOptional()
  @IsString()
  mfgDate?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialStockQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStockLevel?: number;

  @IsOptional()
  @IsString()
  rackLocation?: string;

  @IsOptional()
  @IsString()
  warehouseLocation?: string;

  // -----------------------------------------------------------
  // Section 5: Supplier Information
  // -----------------------------------------------------------
  @IsOptional()
  @IsString()
  supplierId?: string;

  // -----------------------------------------------------------
  // Section 6: Additional Settings
  // -----------------------------------------------------------
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  lowStockAlert?: boolean;

  @IsOptional()
  @IsBoolean()
  expiryAlert?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  // Multi-unit packaging definitions (optional)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicineUnitDto)
  units?: MedicineUnitDto[];
}
