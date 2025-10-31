import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BudgetMonth, Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { UserContextService } from '../../common/services/user-context.service';
import { UpdateBudgetCategoryDto } from './dto/update-budget-category.dto';
import { BudgetMonthEntity } from './entities/budget-month.entity';
import { BudgetCategoryGroupEntity } from './entities/budget-group.entity';
import { BudgetCategoryEntity } from './entities/budget-category.entity';

type GroupWithCategories = Prisma.BudgetCategoryGroupGetPayload<{
  include: { category: true; categories: { include: { category: true } } };
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

  async getMonth(monthKey: string): Promise<BudgetMonthEntity> {
    const userId = this.userContext.getUserId();
    const month = await this.getOrCreateMonth(monthKey, userId);
    await this.ensureMonthStructure(month, userId);
    return this.buildMonthEntity(month);
  }

  async updateCategory(
    monthKey: string,
    categoryId: string,
    dto: UpdateBudgetCategoryDto,
  ): Promise<BudgetCategoryEntity> {
    const userId = this.userContext.getUserId();
    const month = await this.getOrCreateMonth(monthKey, userId);
    await this.ensureMonthStructure(month, userId);

    const group = await this.prisma.budgetCategoryGroup.findFirst({
      where: { monthId: month.id, categoryId },
      select: { id: true },
    });

    if (!group) {
      throw new NotFoundException(
        `Budget category group for month ${monthKey} and category ${categoryId} not found`,
      );
    }

    const budgetCategory = await this.prisma.budgetCategory.findFirst({
      where: { groupId: group.id, categoryId },
      include: { category: true },
    });

    if (!budgetCategory) {
      throw new NotFoundException(
        `Budget category for month ${monthKey} and category ${categoryId} not found`,
      );
    }

    const data: Prisma.BudgetCategoryUpdateInput = {};
    if (dto.assigned !== undefined) {
      data.assigned = new Prisma.Decimal(dto.assigned);
    }
    if (dto.activity !== undefined) {
      data.activity = new Prisma.Decimal(dto.activity);
    }
    if (dto.available !== undefined) {
      data.available = new Prisma.Decimal(dto.available);
    } else if (dto.assigned !== undefined || dto.activity !== undefined) {
      const assigned = dto.assigned ?? Number(budgetCategory.assigned);
      const activity = dto.activity ?? Number(budgetCategory.activity);
      data.available = new Prisma.Decimal(assigned + activity);
    }

    if (Object.keys(data).length === 0) {
      return this.toCategoryEntity(budgetCategory);
    }

    const updated = await this.prisma.budgetCategory.update({
      where: { id: budgetCategory.id },
      data,
      include: { category: true },
    });

    const entity = this.toCategoryEntity(updated);
    this.events.emit('budget.category.updated', entity);
    return entity;
  }

  private async buildMonthEntity(month: BudgetMonth): Promise<BudgetMonthEntity> {
    const monthSlug = `${month.month.getFullYear()}-${(month.month.getMonth() + 1)
      .toString()
      .padStart(2, '0')}`;

    const groups = await this.prisma.budgetCategoryGroup.findMany({
      where: { monthId: month.id },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { category: { name: 'asc' } },
      ],
      include: {
        category: true,
        categories: {
          include: { category: true },
          orderBy: [
            { category: { sortOrder: 'asc' } },
            { category: { name: 'asc' } },
          ],
        },
      },
    });

    const groupEntities = groups.map((group) => this.toGroupEntity(group));
    const totalAssigned = groupEntities.reduce((sum, g) => sum + g.assigned, 0);
    const totalActivity = groupEntities.reduce((sum, g) => sum + g.activity, 0);
    const totalAvailable = groupEntities.reduce((sum, g) => sum + g.available, 0);

    return plainToInstance(BudgetMonthEntity, {
      id: month.id,
      month: monthSlug,
      availableCarryover: Number(month.availableCarryover),
      income: Number(month.income),
      assigned: Number(month.assigned),
      activity: Number(month.activity),
      available: Number(month.available),
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
      categoryId: group.categoryId,
      category: group.category,
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
      categoryId: category.categoryId,
      category: category.category,
      assigned: Number(category.assigned),
      activity: Number(category.activity),
      available: Number(category.available),
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    });
  }

  private async getOrCreateMonth(monthKey: string, userId: string): Promise<BudgetMonth> {
    const byId = await this.prisma.budgetMonth.findFirst({
      where: { id: monthKey, userId },
    });
    if (byId) {
      return byId;
    }

    const date = this.monthStringToDate(monthKey);
    let month = await this.prisma.budgetMonth.findFirst({
      where: { userId, month: date },
    });
    if (!month) {
      month = await this.prisma.budgetMonth.create({
        data: {
          userId,
          month: date,
          availableCarryover: new Prisma.Decimal(0),
          income: new Prisma.Decimal(0),
          assigned: new Prisma.Decimal(0),
          available: new Prisma.Decimal(0),
          activity: new Prisma.Decimal(0),
        },
      });
    }
    return month;
  }

  private async ensureMonthStructure(month: BudgetMonth, userId: string): Promise<void> {
    const parentCategories = await this.prisma.category.findMany({
      where: { userId, parentCategoryId: null, kind: 'EXPENSE' },
      include: {
        subCategories: {
          where: { userId, kind: 'EXPENSE' },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const existingGroups = await this.prisma.budgetCategoryGroup.findMany({
      where: { monthId: month.id },
      select: { id: true, categoryId: true },
    });

    const groupByCategory = new Map(existingGroups.map((group) => [group.categoryId, group]));

    for (const parent of parentCategories) {
      let group = groupByCategory.get(parent.id);
      if (!group) {
        const created = await this.prisma.budgetCategoryGroup.create({
          data: {
            monthId: month.id,
            categoryId: parent.id,
          },
        });
        groupByCategory.set(parent.id, created);
        group = created;
      }

      const children = parent.subCategories.filter((child) => child.parentCategoryId !== null);
      if (children.length === 0) {
        // no child categories defined for this parent; keep the group but skip budget-category entries
        continue;
      }
      const existingBudgetCategories = await this.prisma.budgetCategory.findMany({
        where: { groupId: group.id },
        select: { categoryId: true },
      });

      const existingIds = new Set(existingBudgetCategories.map((entry) => entry.categoryId));
      for (const child of children) {
        if (!existingIds.has(child.id)) {
          await this.prisma.budgetCategory.create({
            data: {
              groupId: group.id,
              categoryId: child.id,
              assigned: new Prisma.Decimal(0),
              activity: new Prisma.Decimal(0),
              available: new Prisma.Decimal(0),
            },
          });
        }
      }
    }
  }

  private monthStringToDate(month: string): Date {
    const match = month.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    if (!match) {
      throw new BadRequestException(`Format de mois invalide: ${month}`);
    }
    const [, year, monthPart] = match;
    const yearNum = Number(year);
    const monthIndex = Number(monthPart) - 1;
    return new Date(Date.UTC(yearNum, monthIndex, 1));
  }
}
