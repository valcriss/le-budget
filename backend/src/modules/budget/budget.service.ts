import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, BudgetMonth } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { UserContextService } from '../../common/services/user-context.service';
import { CreateBudgetMonthDto } from './dto/create-budget-month.dto';
import { UpdateBudgetMonthDto } from './dto/update-budget-month.dto';
import { CreateBudgetGroupDto } from './dto/create-budget-group.dto';
import { UpdateBudgetGroupDto } from './dto/update-budget-group.dto';
import { CreateBudgetCategoryDto } from './dto/create-budget-category.dto';
import { UpdateBudgetCategoryDto } from './dto/update-budget-category.dto';
import { BudgetMonthEntity } from './entities/budget-month.entity';
import { BudgetCategoryGroupEntity } from './entities/budget-group.entity';
import { BudgetCategoryEntity } from './entities/budget-category.entity';

type GroupWithCategories = Prisma.BudgetCategoryGroupGetPayload<{
  include: { categories: { include: { category: true } } };
}>;

type CategoryWithRelation = Prisma.BudgetCategoryGetPayload<{
  include: { category: true };
}>;

@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly userContext: UserContextService,
  ) {}

  async listMonths(): Promise<BudgetMonthEntity[]> {
    const userId = this.userContext.getUserId();
    const months = await this.prisma.budgetMonth.findMany({
      where: { userId },
      orderBy: { month: 'desc' },
    });
    return Promise.all(months.map((month) => this.buildMonthEntity(month, false)));
  }

  async createMonth(dto: CreateBudgetMonthDto): Promise<BudgetMonthEntity> {
    const userId = this.userContext.getUserId();
    const monthDate = this.monthStringToDate(dto.month);

    const month = await this.prisma.budgetMonth.create({
      data: {
        userId,
        month: monthDate,
        availableCarryover: new Prisma.Decimal(dto.availableCarryover ?? 0),
        income: new Prisma.Decimal(dto.income ?? 0),
      },
    });

    const entity = await this.buildMonthEntity(month);
    this.events.emit('budget.month.created', entity);
    return entity;
  }

  async getMonth(key: string): Promise<BudgetMonthEntity> {
    const userId = this.userContext.getUserId();
    const month = await this.resolveMonth(key, userId);
    return this.buildMonthEntity(month);
  }

  async updateMonth(id: string, dto: UpdateBudgetMonthDto): Promise<BudgetMonthEntity> {
    const userId = this.userContext.getUserId();
    const existing = await this.prisma.budgetMonth.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new NotFoundException(`Budget month ${id} not found`);
    }

    const data: Prisma.BudgetMonthUpdateInput = {};
    if (dto.month) {
      data.month = this.monthStringToDate(dto.month);
    }
    if (dto.availableCarryover !== undefined) {
      data.availableCarryover = new Prisma.Decimal(dto.availableCarryover);
    }
    if (dto.income !== undefined) {
      data.income = new Prisma.Decimal(dto.income);
    }

    const updated = await this.prisma.budgetMonth.update({
      where: { id },
      data,
    });

    const entity = await this.buildMonthEntity(updated);
    this.events.emit('budget.month.updated', entity);
    return entity;
  }

  async createGroup(monthId: string, dto: CreateBudgetGroupDto): Promise<BudgetCategoryGroupEntity> {
    const userId = this.userContext.getUserId();
    const month = await this.prisma.budgetMonth.findFirst({ where: { id: monthId, userId } });
    if (!month) {
      throw new NotFoundException(`Budget month ${monthId} not found`);
    }

    const sortOrder = await this.resolveNextGroupOrder(month.id, dto.sortOrder);

    const group = await this.prisma.budgetCategoryGroup.create({
      data: {
        monthId: month.id,
        name: dto.name,
        sortOrder,
      },
      include: { categories: { include: { category: true }, orderBy: { sortOrder: 'asc' } } },
    });

    const entity = this.toGroupEntity(group);
    this.events.emit('budget.group.created', entity);
    return entity;
  }

  async updateGroup(groupId: string, dto: UpdateBudgetGroupDto): Promise<BudgetCategoryGroupEntity> {
    const group = await this.ensureGroup(groupId);

    const data: Prisma.BudgetCategoryGroupUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }

    const updated = await this.prisma.budgetCategoryGroup.update({
      where: { id: group.id },
      data,
      include: { categories: { include: { category: true }, orderBy: { sortOrder: 'asc' } } },
    });

    const entity = this.toGroupEntity(updated);
    this.events.emit('budget.group.updated', entity);
    return entity;
  }

  async removeGroup(groupId: string): Promise<BudgetCategoryGroupEntity> {
    const group = await this.ensureGroup(groupId);

    const deleted = await this.prisma.budgetCategoryGroup.delete({
      where: { id: group.id },
      include: { categories: { include: { category: true }, orderBy: { sortOrder: 'asc' } } },
    });

    const entity = this.toGroupEntity(deleted);
    this.events.emit('budget.group.deleted', entity);
    return entity;
  }

  async createCategory(
    groupId: string,
    dto: CreateBudgetCategoryDto,
  ): Promise<BudgetCategoryEntity> {
    const group = await this.ensureGroup(groupId);

    if (dto.categoryId) {
      await this.ensureCategoryOwnership(dto.categoryId, group.month.userId);
    }

    const sortOrder = await this.resolveNextCategoryOrder(group.id, dto.sortOrder);

    const category = await this.prisma.budgetCategory.create({
      data: {
        groupId: group.id,
        name: dto.name,
        categoryId: dto.categoryId,
        assigned: new Prisma.Decimal(dto.assigned ?? 0),
        activity: new Prisma.Decimal(dto.activity ?? 0),
        available: new Prisma.Decimal(
          dto.available ?? (dto.assigned ?? 0) + (dto.activity ?? 0),
        ),
        sortOrder,
      },
      include: { category: true },
    });

    const entity = this.toCategoryEntity(category);
    this.events.emit('budget.category.created', entity);
    return entity;
  }

  async updateCategory(
    categoryId: string,
    dto: UpdateBudgetCategoryDto,
  ): Promise<BudgetCategoryEntity> {
    const existing = await this.ensureBudgetCategory(categoryId);

    if (dto.categoryId) {
      await this.ensureCategoryOwnership(dto.categoryId, existing.group.month.userId);
    }

    const data: Prisma.BudgetCategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : { disconnect: true };
    }
    if (dto.assigned !== undefined) data.assigned = new Prisma.Decimal(dto.assigned);
    if (dto.activity !== undefined) data.activity = new Prisma.Decimal(dto.activity);
    if (dto.available !== undefined) {
      data.available = new Prisma.Decimal(dto.available);
    } else if (dto.assigned !== undefined || dto.activity !== undefined) {
      const assigned = dto.assigned ?? Number(existing.assigned);
      const activity = dto.activity ?? Number(existing.activity);
      data.available = new Prisma.Decimal(assigned + activity);
    }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    const updated = await this.prisma.budgetCategory.update({
      where: { id: existing.id },
      data,
      include: { category: true },
    });

    const entity = this.toCategoryEntity(updated);
    this.events.emit('budget.category.updated', entity);
    return entity;
  }

  async removeCategory(categoryId: string): Promise<BudgetCategoryEntity> {
    const existing = await this.ensureBudgetCategory(categoryId);

    const deleted = await this.prisma.budgetCategory.delete({
      where: { id: existing.id },
      include: { category: true },
    });

    const entity = this.toCategoryEntity(deleted);
    this.events.emit('budget.category.deleted', entity);
    return entity;
  }

  private async buildMonthEntity(
    month: BudgetMonth,
    includeGroups = true,
  ): Promise<BudgetMonthEntity> {
    const monthSlug = `${month.month.getFullYear()}-${(month.month.getMonth() + 1)
      .toString()
      .padStart(2, '0')}`;

    let groups: GroupWithCategories[] = [];
    if (includeGroups) {
      groups = await this.prisma.budgetCategoryGroup.findMany({
        where: { monthId: month.id },
        orderBy: { sortOrder: 'asc' },
        include: { categories: { include: { category: true }, orderBy: { sortOrder: 'asc' } } },
      });
    }

    const groupEntities = groups.map((group) => this.toGroupEntity(group));
    const totalAssigned = groupEntities.reduce((sum, g) => sum + g.assigned, 0);
    const totalActivity = groupEntities.reduce((sum, g) => sum + g.activity, 0);
    const totalAvailable = groupEntities.reduce((sum, g) => sum + g.available, 0);

    return plainToInstance(BudgetMonthEntity, {
      id: month.id,
      month: monthSlug,
      availableCarryover: Number(month.availableCarryover),
      income: Number(month.income),
      totalAssigned,
      totalActivity,
      totalAvailable,
      groups: groupEntities,
      createdAt: month.createdAt,
      updatedAt: month.updatedAt,
    });
  }

  private toGroupEntity(group: GroupWithCategories): BudgetCategoryGroupEntity {
    const items = group.categories.map((category) => this.toCategoryEntity(category));
    const assigned = items.reduce((sum, c) => sum + c.assigned, 0);
    const activity = items.reduce((sum, c) => sum + c.activity, 0);
    const available = items.reduce((sum, c) => sum + c.available, 0);

    return plainToInstance(BudgetCategoryGroupEntity, {
      id: group.id,
      monthId: group.monthId,
      name: group.name,
      sortOrder: group.sortOrder,
      assigned,
      activity,
      available,
      items,
    });
  }

  private toCategoryEntity(category: CategoryWithRelation): BudgetCategoryEntity {
    return plainToInstance(BudgetCategoryEntity, {
      id: category.id,
      groupId: category.groupId,
      name: category.name,
      categoryId: category.categoryId ?? null,
      categoryName: category.category?.name ?? null,
      assigned: Number(category.assigned),
      activity: Number(category.activity),
      available: Number(category.available),
      sortOrder: category.sortOrder,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    });
  }

  private monthStringToDate(month: string): Date {
    const [year, monthPart] = month.split('-');
    const date = new Date(Number(year), Number(monthPart) - 1, 1);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid month format ${month}`);
    }
    return date;
  }

  private async resolveMonth(key: string, userId: string): Promise<BudgetMonth> {
    const byId = await this.prisma.budgetMonth.findFirst({
      where: { id: key, userId },
    });
    if (byId) return byId;

    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) {
      const date = this.monthStringToDate(key);
      const month = await this.prisma.budgetMonth.findFirst({
        where: { month: date, userId },
      });
      if (month) return month;
    }

    throw new NotFoundException(`Budget month ${key} not found`);
  }

  private async ensureGroup(groupId: string): Promise<
    Prisma.BudgetCategoryGroupGetPayload<{
      include: {
        month: { select: { id: true, userId: true } };
        categories: { include: { category: true }, orderBy: { sortOrder: 'asc' } };
      };
    }>
  > {
    const group = await this.prisma.budgetCategoryGroup.findUnique({
      where: { id: groupId },
      include: {
        month: { select: { id: true, userId: true } },
        categories: { include: { category: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!group) {
      throw new NotFoundException(`Budget group ${groupId} not found`);
    }
    const userId = this.userContext.getUserId();
    if (group.month.userId !== userId) {
      throw new NotFoundException(`Budget group ${groupId} not found`);
    }
    return group;
  }

  private async ensureBudgetCategory(categoryId: string) {
    const category = await this.prisma.budgetCategory.findUnique({
      where: { id: categoryId },
      include: {
        category: true,
        group: {
          include: {
            month: { select: { id: true, userId: true } },
          },
        },
      },
    });
    if (!category) {
      throw new NotFoundException(`Budget category ${categoryId} not found`);
    }
    const userId = this.userContext.getUserId();
    if (category.group.month.userId !== userId) {
      throw new NotFoundException(`Budget category ${categoryId} not found`);
    }
    return category;
  }

  private async ensureCategoryOwnership(categoryId: string, userId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }
  }

  private async resolveNextGroupOrder(monthId: string, requested?: number | null) {
    if (requested !== undefined && requested !== null) {
      return requested;
    }
    const result = await this.prisma.budgetCategoryGroup.aggregate({
      where: { monthId },
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async resolveNextCategoryOrder(groupId: string, requested?: number | null) {
    if (requested !== undefined && requested !== null) {
      return requested;
    }
    const result = await this.prisma.budgetCategory.aggregate({
      where: { groupId },
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }
}
