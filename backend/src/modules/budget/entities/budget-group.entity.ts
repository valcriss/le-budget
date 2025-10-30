import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { CategoryEntity } from '../../categories/entities/category.entity';
import { BudgetCategoryEntity } from './budget-category.entity';

export class BudgetCategoryGroupEntity {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  monthId!: string;

  @ApiProperty()
  @Expose()
  categoryId!: string;

  @ApiProperty({ type: () => CategoryEntity })
  @Expose()
  @Type(() => CategoryEntity)
  category!: CategoryEntity;

  @ApiProperty()
  @Expose()
  @ApiProperty()
  @Expose()
  assigned!: number;

  @ApiProperty()
  @Expose()
  activity!: number;

  @ApiProperty()
  @Expose()
  available!: number;

  @ApiProperty({ type: () => [BudgetCategoryEntity] })
  @Expose()
  @Type(() => BudgetCategoryEntity)
  items!: BudgetCategoryEntity[];
}
