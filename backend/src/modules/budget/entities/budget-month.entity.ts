import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { BudgetCategoryGroupEntity } from './budget-group.entity';

export class BudgetMonthEntity {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ description: 'Month identifier (YYYY-MM)' })
  @Expose()
  month!: string;

  @ApiProperty({ description: 'Carryover funds from previous month' })
  @Expose()
  availableCarryover!: number;

  @ApiProperty({ description: 'Income for the month' })
  @Expose()
  income!: number;

  @ApiProperty({ description: 'Total assigned across all categories' })
  @Expose()
  totalAssigned!: number;

  @ApiProperty({ description: 'Total activity (spent) across all categories' })
  @Expose()
  totalActivity!: number;

  @ApiProperty({ description: 'Total available after assignments and activity' })
  @Expose()
  totalAvailable!: number;

  @ApiProperty({ type: () => [BudgetCategoryGroupEntity] })
  @Expose()
  @Type(() => BudgetCategoryGroupEntity)
  groups!: BudgetCategoryGroupEntity[];

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}
