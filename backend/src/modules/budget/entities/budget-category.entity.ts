import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { CategoryEntity } from '../../categories/entities/category.entity';

export class BudgetCategoryEntity {
  /* c8 ignore start */
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

  @ApiProperty({ description: 'Required amount for the month based on planned expenses' })
  @Expose()
  requiredAmount!: number;

  @ApiProperty({ description: 'Optimized amount with smoothing for future expenses' })
  @Expose()
  optimizedAmount!: number;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
  /* c8 ignore end */

  hasAvailableFunds(): boolean {
    return this.available > 0;
  }
}
