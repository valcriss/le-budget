import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
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
  name!: string;

  @ApiProperty()
  @Expose()
  sortOrder!: number;

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
