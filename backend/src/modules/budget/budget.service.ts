import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BudgetMonth, CategoryKind, Prisma, TransactionType } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { TransactionsService } from '../transactions/transactions.service';
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

type CategoryAmounts = {
  requiredAmount: number;
  optimizedAmount: number;
};

@Injectable()
export class BudgetService {
  /* c8 ignore start */
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly userContext: UserContextService,
    private readonly transactions: TransactionsService,
  ) {}
  /* c8 ignore end */

  async getMonth(monthKey: string): Promise<BudgetMonthEntity> {
    const userId = this.userContext.getUserId();
    const { month } = await this.getOrCreateMonth(monthKey, userId);
    await this.ensureMonthStructure(month, userId);

    const updatedMonth = await this.transactions.recalculateBudgetMonthForUser(
      month.month,
      userId,
    );

    return this.buildMonthEntity(updatedMonth);
  }

  async updateCategory(
    monthKey: string,
    categoryId: string,
    dto: UpdateBudgetCategoryDto,
  ): Promise<BudgetCategoryEntity> {
    const userId = this.userContext.getUserId();
    const { month } = await this.getOrCreateMonth(monthKey, userId);
    await this.ensureMonthStructure(month, userId);

    const budgetCategory = await this.prisma.budgetCategory.findFirst({
      where: {
        categoryId,
        group: { monthId: month.id },
      },
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
    await this.transactions.recalculateBudgetMonthForUser(month.month, userId);
    return entity;
  }

  private async buildMonthEntity(month: BudgetMonth): Promise<BudgetMonthEntity> {
    const monthDate = month.month;
    const monthSlug = `${monthDate.getUTCFullYear()}-${(monthDate.getUTCMonth() + 1)
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

    const groupCategories = groups.flatMap((group) => group.categories);
    const computedAmounts = await this.computeCategoryAmounts(
      monthDate,
      groupCategories,
      month.userId,
    );
    const groupEntities = groups.map((group) => this.toGroupEntity(group, computedAmounts));
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

  private toGroupEntity(
    group: GroupWithCategories,
    computedAmounts: Map<string, CategoryAmounts>,
  ): BudgetCategoryGroupEntity {
    const items = group.categories.map((category) =>
      this.toCategoryEntity(category, computedAmounts.get(category.categoryId)),
    );
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

  private toCategoryEntity(
    category: CategoryWithRelation,
    computed?: CategoryAmounts,
  ): BudgetCategoryEntity {
    return plainToInstance(BudgetCategoryEntity, {
      id: category.id,
      groupId: category.groupId,
      categoryId: category.categoryId,
      category: category.category,
      assigned: Number(category.assigned),
      activity: Number(category.activity),
      available: Number(category.available),
      requiredAmount: computed?.requiredAmount ?? 0,
      optimizedAmount: computed?.optimizedAmount ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    });
  }

  private async computeCategoryAmounts(
    monthStart: Date,
    categories: CategoryWithRelation[],
    userId: string,
  ): Promise<Map<string, CategoryAmounts>> {
    const results = new Map<string, CategoryAmounts>();
    const categoryIds = Array.from(
      new Set(categories.map((category) => category.categoryId).filter(Boolean)),
    );
    if (categoryIds.length === 0) {
      return results;
    }

    const nextMonthStart = this.getNextMonth(monthStart);

    const currentTransactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        categoryId: { in: categoryIds },
        category: { kind: CategoryKind.EXPENSE },
        transactionType: TransactionType.NONE,
        amount: { lt: 0 },
        date: { gte: monthStart, lt: nextMonthStart },
      },
      select: { categoryId: true, amount: true },
    });

    const futureTransactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        categoryId: { in: categoryIds },
        category: { kind: CategoryKind.EXPENSE },
        transactionType: TransactionType.NONE,
        amount: { lt: 0 },
        date: { gte: nextMonthStart },
      },
      select: { categoryId: true, amount: true, date: true },
      orderBy: { date: 'asc' },
    });

    const requiredByCategory = new Map<string, number>();
    for (const txn of currentTransactions) {
      if (!txn.categoryId) {
        continue;
      }
      const current = requiredByCategory.get(txn.categoryId) ?? 0;
      requiredByCategory.set(txn.categoryId, current + Math.abs(Number(txn.amount)));
    }

    const futuresByCategory = new Map<string, Array<{ amount: number; date: Date }>>();
    for (const txn of futureTransactions) {
      if (!txn.categoryId) {
        continue;
      }
      const list = futuresByCategory.get(txn.categoryId) ?? [];
      list.push({ amount: Math.abs(Number(txn.amount)), date: txn.date });
      futuresByCategory.set(txn.categoryId, list);
    }

    for (const category of categories) {
      const requiredRaw = requiredByCategory.get(category.categoryId) ?? 0;
      const required = this.roundTo4(requiredRaw);
      const futures = futuresByCategory.get(category.categoryId) ?? [];
      if (futures.length === 0) {
        results.set(category.categoryId, {
          requiredAmount: required,
          optimizedAmount: required,
        });
        continue;
      }

      const available = Math.max(0, Number(category.available ?? 0));
      let remainingBalance = available;
      let smoothingTotal = 0;

      for (const future of futures) {
        const take = Math.min(remainingBalance, future.amount);
        remainingBalance -= take;
        const remaining = Math.max(0, future.amount - take);
        const monthsUseful = this.monthsBetweenInclusive(
          monthStart,
          this.getMonthStart(future.date),
        );
        if (monthsUseful > 0) {
          smoothingTotal += remaining / monthsUseful;
        }
      }

      const optimized = this.roundTo4(requiredRaw + smoothingTotal);
      results.set(category.categoryId, {
        requiredAmount: required,
        optimizedAmount: optimized,
      });
    }

    return results;
  }

  private monthsBetweenInclusive(from: Date, to: Date): number {
    const fromIndex = from.getUTCFullYear() * 12 + from.getUTCMonth();
    const toIndex = to.getUTCFullYear() * 12 + to.getUTCMonth();
    if (toIndex < fromIndex) {
      return 0;
    }
    return toIndex - fromIndex + 1;
  }

  private roundTo4(value: number): number {
    const factor = 10_000;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  private async getOrCreateMonth(
    monthKey: string,
    userId: string,
  ): Promise<{ month: BudgetMonth; created: boolean }> {
    const byId = await this.prisma.budgetMonth.findFirst({
      where: { id: monthKey, userId },
    });
    if (byId) {
      return { month: byId, created: false };
    }

    const monthStart = this.monthStringToDate(monthKey);
    const rangeStart = monthStart;
    const rangeEnd = this.getNextMonth(monthStart);

    let month = await this.prisma.budgetMonth.findFirst({
      where: {
        userId,
        month: {
          gte: rangeStart,
          lt: rangeEnd,
        },
      },
    });

    let created = false;
    if (!month) {
      month = await this.prisma.budgetMonth.create({
        data: {
          userId,
          month: monthStart,
          availableCarryover: new Prisma.Decimal(0),
          income: new Prisma.Decimal(0),
          assigned: new Prisma.Decimal(0),
          available: new Prisma.Decimal(0),
          activity: new Prisma.Decimal(0),
        },
      });
      created = true;
    } else if (!this.isSameMonth(month.month, monthStart)) {
      month = await this.prisma.budgetMonth.update({
        where: { id: month.id },
        data: { month: monthStart },
      });
    }
    return { month, created };
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
    const createdCategoryIds = new Set<string>();

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
          createdCategoryIds.add(child.id);
        }
      }
    }

    if (createdCategoryIds.size > 0) {
      await this.transactions.recalculateBudgetMonthForUser(month.month, userId);
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

  private getNextMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  }

  private getMonthStart(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private isSameMonth(a: Date, b: Date): boolean {
    return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
  }
}
