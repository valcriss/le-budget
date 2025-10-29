import { Injectable, NotFoundException } from '@nestjs/common';
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
    const category = await this.prisma.category.create({
      data: {
        userId,
        name: dto.name,
        kind: dto.kind ?? CategoryKind.EXPENSE,
        description: dto.description,
        color: this.normalizeColor(dto.color),
        icon: dto.icon,
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
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
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

    const data: Prisma.CategoryUpdateInput = {
      name: dto.name ?? existing.name,
      kind: dto.kind ?? existing.kind,
      description: dto.description ?? existing.description,
      color: dto.color !== undefined ? this.normalizeColor(dto.color) : existing.color,
      icon: dto.icon ?? existing.icon,
    };

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

    const category = await this.prisma.category.delete({ where: { id } });
    const entity = this.toEntity(category);
    this.events.emit('category.deleted', entity);
    return entity;
  }

  private toEntity(category: { [key: string]: any }): CategoryEntity {
    return plainToInstance(CategoryEntity, category);
  }

  private normalizeColor(color?: string) {
    if (!color) return null;
    const normalized = color.startsWith('#') ? color : `#${color}`;
    return normalized.toUpperCase();
  }
}
