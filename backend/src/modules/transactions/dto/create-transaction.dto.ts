import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { TransactionStatus, TransactionType } from '@prisma/client';

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

  @ApiPropertyOptional({ description: 'Category identifier' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Transaction status', enum: TransactionStatus, default: TransactionStatus.NONE })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({ description: 'Type de transaction', enum: TransactionType, default: TransactionType.NONE })
  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;

  @ApiPropertyOptional({ description: 'Transaction liée', format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  linkedTransactionId?: string | null;
}
