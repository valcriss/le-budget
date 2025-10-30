import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateBudgetCategoryDto {
  @ApiPropertyOptional({ description: 'Montant assigné', example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  assigned?: number;

  @ApiPropertyOptional({ description: 'Activité/dépensé (généralement négatif)', example: -50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  activity?: number;

  @ApiPropertyOptional({ description: 'Disponible restant', example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  available?: number;
}
