import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { TransactionEntity } from './transaction.entity';

export class TransactionsListEntity {
  /* c8 ignore start */
  @ApiProperty({ type: () => [TransactionEntity] })
  @Expose()
  @Type(() => TransactionEntity)
  items!: TransactionEntity[];

  @ApiProperty({ example: { total: 0, skip: 0, take: 50 } })
  @Expose()
  meta!: {
    total: number;
    skip: number;
    take: number;
  };
  /* c8 ignore end */

  hasItems(): boolean {
    return Array.isArray(this.items) && this.items.length > 0;
  }
}
