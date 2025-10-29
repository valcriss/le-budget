import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class BudgetCategoryEntity {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  groupId!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  categoryId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  categoryName?: string | null;

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
  sortOrder!: number;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}
