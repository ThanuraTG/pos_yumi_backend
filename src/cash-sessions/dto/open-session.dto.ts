import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class OpenSessionDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  openingFloat: number;
}

