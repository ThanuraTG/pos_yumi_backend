import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
  Matches
} from 'class-validator';
import { Gender } from '@prisma/client';

export class SelfRegisterCustomerDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(150, { message: 'Full name cannot exceed 150 characters' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Birthday is required' })
  birthday: string; // ISO format string YYYY-MM-DD

  @IsEnum(Gender, { message: 'Gender must be MALE, FEMALE, OTHER, or PREFER_NOT_TO_SAY' })
  @IsNotEmpty({ message: 'Gender is required' })
  gender: Gender;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^(\+94|0)?[1-9]\d{8}$/, {
    message: 'Please provide a valid Sri Lankan phone number (e.g., 0771234567 or +94771234567)'
  })
  phone: string;

  @IsBoolean({ message: 'WhatsApp usage confirmation is required' })
  hasWhatsapp: boolean;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsString()
  @IsNotEmpty({ message: 'Address is required' })
  @MinLength(5, { message: 'Please enter a complete residential address' })
  address: string;

  @IsString()
  @IsNotEmpty({ message: 'District is required' })
  district: string;

  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  city: string;

  @IsOptional()
  @IsString()
  familyMemberName?: string;

  @IsOptional()
  @IsString()
  familyMemberPhone?: string;

  @IsBoolean({ message: 'Privacy policy consent is required' })
  privacyConsent: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappConsent?: boolean;

  @IsOptional()
  @IsBoolean()
  medicineReminderConsent?: boolean;

  // Honeypot field for bot spam prevention (must remain empty)
  @IsOptional()
  @IsString()
  website_hp?: string;
}
