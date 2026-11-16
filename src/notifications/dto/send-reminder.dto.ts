import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SendWhatsappReminderDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  medicineName: string;

  @IsString()
  @IsNotEmpty()
  dosageInstruction: string;

  @IsString()
  @IsOptional()
  scheduledTime?: string; // 'MORNING' | 'AFTERNOON' | 'NIGHT'
}

