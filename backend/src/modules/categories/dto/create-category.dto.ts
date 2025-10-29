import { CategoryKind } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category label' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: CategoryKind, default: CategoryKind.EXPENSE })
  @IsOptional()
  @IsEnum(CategoryKind)
  kind?: CategoryKind;

  @ApiPropertyOptional({ description: 'Optional description' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @ApiPropertyOptional({ description: 'Hex color code', example: '#FF9900' })
  @IsOptional()
  @Matches(/^#?[0-9A-Fa-f]{6}$/)
  color?: string;

  @ApiPropertyOptional({ description: 'Icon identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  icon?: string;
}
