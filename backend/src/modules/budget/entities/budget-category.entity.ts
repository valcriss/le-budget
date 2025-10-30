import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { CategoryEntity } from '../../categories/entities/category.entity';

export class BudgetCategoryEntity {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  groupId!: string;

  @ApiProperty()
  @Expose()
  categoryId!: string;

  @ApiProperty({ type: () => CategoryEntity })
  @Expose()
  @Type(() => CategoryEntity)
  category!: CategoryEntity;

  @ApiProperty()
  @Expose()
  assigned!: number;

  @ApiProperty()
  @Expose()
  activity!: number;

  @ApiProperty()
  @Expose()
  available!: number;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}
