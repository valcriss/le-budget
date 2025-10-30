import { AccountType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ description: 'Human readable account name' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ enum: AccountType, default: AccountType.CHECKING })
  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @ApiPropertyOptional({ description: 'Financial institution name' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  institution?: string;

  @ApiPropertyOptional({ description: 'Currency ISO code', default: 'EUR', minLength: 3, maxLength: 3 })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Initial balance for the account', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  initialBalance?: number;

  @ApiPropertyOptional({ description: 'Reconciled balance with bank statements', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  reconciledBalance?: number;

  @ApiPropertyOptional({ description: 'Should the account be archived on creation?', default: false })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
