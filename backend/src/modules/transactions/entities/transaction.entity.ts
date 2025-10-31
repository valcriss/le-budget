import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { TransactionStatus } from '@prisma/client';

export class TransactionEntity {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  accountId!: string;

  @ApiProperty()
  @Expose()
  date!: string;

  @ApiProperty()
  @Expose()
  label!: string;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  categoryId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  categoryName?: string | null;

  @ApiProperty({ description: 'Signed amount' })
  @Expose()
  amount!: number;

  @ApiProperty({ description: 'Debit (absolute value when amount < 0)', required: false })
  @Expose()
  debit?: number;

  @ApiProperty({ description: 'Credit (amount when > 0)', required: false })
  @Expose()
  credit?: number;

  @ApiProperty({ description: 'Running balance after this transaction' })
  @Expose()
  balance!: number;

  @ApiProperty({ enum: TransactionStatus })
  @Expose()
  status!: TransactionStatus;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}
