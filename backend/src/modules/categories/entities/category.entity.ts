import { CategoryKind } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CategoryEntity {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty({ enum: CategoryKind })
  @Expose()
  kind!: CategoryKind;

  @ApiProperty()
  @Expose()
  sortOrder!: number;

  @ApiProperty({ required: false, nullable: true, description: 'Identifiant de la catégorie parente' })
  @Expose()
  parentCategoryId?: string | null;

  @ApiProperty({ required: false, nullable: true, description: 'Identifiant du compte lié (catégorie de transfert)' })
  @Expose()
  linkedAccountId?: string | null;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;

  isTransferCategory(): boolean {
    return this.kind === CategoryKind.TRANSFER;
  }
}
