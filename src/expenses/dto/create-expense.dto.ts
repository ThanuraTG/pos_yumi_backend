import { IsString, IsNotEmpty, IsNumber, Min, IsOptional } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  expenseDate: string;

  @IsString()
  @IsOptional()
  voucherAttachmentUrl?: string;

  @IsString()
  @IsOptional()
  cashSessionId?: string;
}

export class CreateExpenseCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

