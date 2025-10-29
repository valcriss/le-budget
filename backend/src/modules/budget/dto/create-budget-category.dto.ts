import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBudgetCategoryDto {
  @ApiProperty({ description: 'Category name' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'Link to a global category' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Assigned amount', example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  assigned?: number;

  @ApiPropertyOptional({ description: 'Activity/spent amount (usually negative)', example: -50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  activity?: number;

  @ApiPropertyOptional({ description: 'Available amount remaining', example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  available?: number;

  @ApiPropertyOptional({ description: 'Sort order (0-based)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
