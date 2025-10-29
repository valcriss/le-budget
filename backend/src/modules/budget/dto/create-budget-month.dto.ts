import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Matches } from 'class-validator';

export class CreateBudgetMonthDto {
  @ApiProperty({ description: 'Month identifier in YYYY-MM format', example: '2025-10' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month!: string;

  @ApiPropertyOptional({ description: 'Funds available from previous month', example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  availableCarryover?: number;

  @ApiPropertyOptional({ description: 'Income for the current month', example: 3200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  income?: number;
}
