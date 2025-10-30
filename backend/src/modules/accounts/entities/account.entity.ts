import { AccountType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class AccountEntity {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty({ enum: AccountType })
  @Expose()
  type!: AccountType;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  institution?: string | null;

  @ApiProperty({ default: 'EUR' })
  @Expose()
  currency!: string;

  @ApiProperty({ description: 'Initial starting balance' })
  @Expose()
  initialBalance!: number;

  @ApiProperty({ description: 'Latest known balance' })
  @Expose()
  currentBalance!: number;

  @ApiProperty({ description: 'Balance reconciled with bank statements' })
  @Expose()
  reconciledBalance!: number;

  @ApiProperty({ default: false })
  @Expose()
  archived!: boolean;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}
