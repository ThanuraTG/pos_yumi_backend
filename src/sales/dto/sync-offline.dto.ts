import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSaleDto } from './create-sale.dto';

export class SyncOfflineSalesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleDto)
  sales: CreateSaleDto[];
}
