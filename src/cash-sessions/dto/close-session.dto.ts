import { IsNotEmpty, IsNumber, Min, IsOptional, IsString } from 'class-validator';

export class CloseSessionDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  countedCash: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

