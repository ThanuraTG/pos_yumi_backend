import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsEnum, IsArray } from 'class-validator';
import { PrescriptionStatus, Gender } from '@prisma/client';

export class PrescribedItemDto {
  @IsString()
  @IsNotEmpty()
  medicineName: string;

  @IsString()
  @IsOptional()
  dosage?: string;

  @IsString()
  @IsOptional()
  frequency?: string;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  instructions?: string;
}

export class CreatePrescriptionDto {
  @IsString()
  @IsOptional()
  patientId?: string;

  // Unregistered / Walk-in Customer fields
  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsInt()
  @IsOptional()
  patientAge?: number;

  @IsEnum(Gender)
  @IsOptional()
  patientGender?: Gender;

  @IsString()
  @IsNotEmpty()
  doctorName: string;

  @IsString()
  @IsOptional()
  doctorSlmcNo?: string;

  @IsString()
  @IsNotEmpty()
  prescriptionDate: string;

  @IsString()
  @IsOptional()
  imageAttachmentUrl?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  totalRefills?: number;

  @IsString()
  @IsOptional()
  clinicalNotes?: string;

  @IsArray()
  @IsOptional()
  prescribedItems?: PrescribedItemDto[];
}

export class UploadPrescriptionScanDto {
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @IsString()
  @IsOptional()
  filename?: string;
}

export class UpdatePrescriptionStatusDto {
  @IsEnum(PrescriptionStatus)
  status: PrescriptionStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
