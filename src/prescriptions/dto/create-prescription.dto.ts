import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { PrescriptionStatus } from '@prisma/client';

export class CreatePrescriptionDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

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
}

export class UpdatePrescriptionStatusDto {
  @IsEnum(PrescriptionStatus)
  status: PrescriptionStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

