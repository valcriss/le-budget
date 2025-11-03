import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoryKind, Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { UserContextService } from '../../common/services/user-context.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryEntity } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly userContext: UserContextService,
  ) {}

  async create(dto: CreateCategoryDto): Promise<CategoryEntity> {
    const userId = this.userContext.getUserId();

    const requestedKind = dto.kind ?? CategoryKind.EXPENSE;
    if (requestedKind === CategoryKind.TRANSFER) {
      throw new BadRequestException('Les catégories de transfert sont gérées automatiquement.');
    }
    if (requestedKind === CategoryKind.INITIAL) {
      throw new BadRequestException('Les catégories initiales sont gérées automatiquement.');
    }
    if (requestedKind === CategoryKind.INCOME || requestedKind === CategoryKind.INCOME_PLUS_ONE) {
      throw new BadRequestException('Les catégories de revenus sont gérées automatiquement.');
    }
    let parentCategoryId: string | null = null;
    if (dto.parentCategoryId) {
      await this.assertParentBelongsToUser(dto.parentCategoryId, userId);
      parentCategoryId = dto.parentCategoryId;
    }

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined || sortOrder === null) {
      sortOrder = await this.resolveNextSortOrder(userId, parentCategoryId);
    }

    const category = await this.prisma.category.create({
      data: {
        userId,
        name: dto.name,
        kind: dto.kind ?? CategoryKind.EXPENSE,
        parentCategoryId,
        sortOrder,
      },
    });

    const entity = this.toEntity(category);
    this.events.emit('category.created', entity);
    return entity;
  }

  async findAll(): Promise<CategoryEntity[]> {
    const userId = this.userContext.getUserId();
    const categories = await this.prisma.category.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return categories.map((category) => this.toEntity(category));
  }

  async findOne(id: string): Promise<CategoryEntity> {
    const userId = this.userContext.getUserId();
    const category = await this.prisma.category.findFirst({ where: { id, userId } });
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return this.toEntity(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    const userId = this.userContext.getUserId();
    const existing = await this.prisma.category.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    if (existing.kind === CategoryKind.TRANSFER) {
      throw new BadRequestException('Les catégories de transfert ne peuvent pas être modifiées.');
    }
    if (existing.kind === CategoryKind.INITIAL) {
      throw new BadRequestException('Les catégories initiales ne peuvent pas être modifiées.');
    }
    if (existing.kind === CategoryKind.INCOME || existing.kind === CategoryKind.INCOME_PLUS_ONE) {
      throw new BadRequestException('Les catégories de revenus ne peuvent pas être modifiées.');
    }

    if (dto.kind === CategoryKind.TRANSFER) {
      throw new BadRequestException('Impossible de définir une catégorie utilisateur comme transfert.');
    }
    if (dto.kind === CategoryKind.INITIAL) {
      throw new BadRequestException('Impossible de définir une catégorie utilisateur comme initial.');
    }
    if (dto.kind === CategoryKind.INCOME || dto.kind === CategoryKind.INCOME_PLUS_ONE) {
      throw new BadRequestException('Impossible de définir une catégorie utilisateur comme revenu.');
    }

    const data: Prisma.CategoryUpdateInput = {
      name: dto.name ?? existing.name,
      kind: dto.kind ?? existing.kind,
    };

    if (dto.parentCategoryId !== undefined) {
      if (dto.parentCategoryId === null) {
        data.parentCategory = { disconnect: true };
      } else {
        if (dto.parentCategoryId === id) {
          throw new BadRequestException('Une catégorie ne peut pas être sa propre parente.');
        }
        await this.assertParentBelongsToUser(dto.parentCategoryId, userId);
        data.parentCategory = { connect: { id: dto.parentCategoryId } };
      }
    }

    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }

    const category = await this.prisma.category.update({
      where: { id },
      data,
    });

    const entity = this.toEntity(category);
    this.events.emit('category.updated', entity);
    return entity;
  }

  async remove(id: string): Promise<CategoryEntity> {
    const userId = this.userContext.getUserId();
    const existing = await this.prisma.category.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    if (existing.kind === CategoryKind.TRANSFER) {
      throw new BadRequestException('Les catégories de transfert ne peuvent pas être supprimées.');
    }
    if (existing.kind === CategoryKind.INITIAL) {
      throw new BadRequestException('Les catégories initiales ne peuvent pas être supprimées.');
    }
    if (existing.kind === CategoryKind.INCOME || existing.kind === CategoryKind.INCOME_PLUS_ONE) {
      throw new BadRequestException('Les catégories de revenus ne peuvent pas être supprimées.');
    }

    const childrenCount = await this.prisma.category.count({
      where: { parentCategoryId: id, userId },
    });
    if (childrenCount > 0) {
      throw new BadRequestException(
        'Impossible de supprimer une catégorie qui possède des sous-catégories.',
      );
    }

    const category = await this.prisma.category.delete({ where: { id } });
    const entity = this.toEntity(category);
    this.events.emit('category.deleted', entity);
    return entity;
  }

  private toEntity(category: { [key: string]: any }): CategoryEntity {
    return plainToInstance(CategoryEntity, category);
  }

  private async assertParentBelongsToUser(parentId: string, userId: string) {
    const parent = await this.prisma.category.findFirst({
      where: { id: parentId, userId },
      select: { id: true },
    });
    if (!parent) {
      throw new NotFoundException(`Catégorie parente ${parentId} introuvable`);
    }
  }

  private async resolveNextSortOrder(userId: string, parentCategoryId: string | null) {
    const { _max } = await this.prisma.category.aggregate({
      where: { userId, parentCategoryId },
      _max: { sortOrder: true },
    });
    return (_max.sortOrder ?? -1) + 1;
  }
}
