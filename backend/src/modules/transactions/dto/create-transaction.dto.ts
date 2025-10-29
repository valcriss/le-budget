import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({ description: 'Transaction date in ISO 8601 format' })
  @IsISO8601()
  date!: string;

  @ApiProperty({ description: 'Payee or label' })
  @IsString()
  @MaxLength(180)
  label!: string;

  @ApiProperty({ description: 'Signed amount where expenses are negative', example: -125.45 })
  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional({ description: 'Optional note' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  memo?: string;

  @ApiPropertyOptional({ description: 'Category identifier' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
