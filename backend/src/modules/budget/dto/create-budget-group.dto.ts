import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBudgetGroupDto {
  @ApiProperty({ description: 'Group label' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'Display order (0-based)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
