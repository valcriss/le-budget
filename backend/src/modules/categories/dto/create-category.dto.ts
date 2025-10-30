import { CategoryKind } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category label' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: CategoryKind, default: CategoryKind.EXPENSE })
  @IsOptional()
  @IsEnum(CategoryKind)
  kind?: CategoryKind;

  @ApiPropertyOptional({
    description: 'Identifiant de la catégorie parente',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  parentCategoryId?: string | null;

  @ApiPropertyOptional({ description: "Ordre d'affichage", example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
