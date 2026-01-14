import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Account,
  BudgetCategory,
  BudgetMonth,
  CategoryKind,
  Prisma,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { UserContextService } from '../../common/services/user-context.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsQueryDto } from './dto/transactions-query.dto';
import { TransactionEntity } from './entities/transaction.entity';
import { TransactionsListEntity } from './entities/transactions-list.entity';
import { AccountEntity } from '../accounts/entities/account.entity';
import { BudgetCategoryEntity } from '../budget/entities/budget-category.entity';
import { CategoryEntity } from '../categories/entities/category.entity';

@Injectable()
export class TransactionsService {
  private readonly DEFAULT_LIMIT = 50;
  private readonly MAX_LIMIT = 200;

  /* c8 ignore start */
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly userContext: UserContextService,
  ) {}
  /* c8 ignore end */

  async findMany(
    accountId: string,
    query: TransactionsQueryDto,
  ): Promise<TransactionsListEntity> {
    const userId = this.userContext.getUserId();
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? this.DEFAULT_LIMIT, this.MAX_LIMIT);

    const where: Prisma.TransactionWhereInput = {
      accountId: account.id,
    };

    if (query.from || query.to) {
      where.date = {};
      if (query.from) {
        (where.date as Prisma.DateTimeFilter).gte = new Date(query.from);
      }
      if (query.to) {
        (where.date as Prisma.DateTimeFilter).lte = new Date(query.to);
      }
    }

    if (query.search) {
      where.label = { contains: query.search, mode: 'insensitive' };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.transactionType) {
      where.transactionType = query.transactionType;
    }

    const [items, total, ledger] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: [
          { date: 'desc' },
          { category: { name: 'asc' } },
          { label: 'asc' },
          { amount: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take,
      }),
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where: { accountId: account.id },
        select: { id: true, amount: true, date: true, createdAt: true, transactionType: true },
        orderBy: [
          { date: 'asc' },
          { createdAt: 'asc' },
        ],
      }),
    ]);

    const runningBalanceMap = this.computeRunningBalances(
      ledger,
      Number(account.initialBalance),
    );

    const entities = items.map((tx) => this.toEntity(tx, runningBalanceMap.get(tx.id) ?? 0));

    return plainToInstance(TransactionsListEntity, {
      items: entities,
      meta: { total, skip, take },
    });
  }

  async create(accountId: string, dto: CreateTransactionDto): Promise<TransactionEntity> {
    const userId = this.userContext.getUserId();
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    if (dto.transactionType === TransactionType.INITIAL) {
      throw new BadRequestException('Les transactions initiales sont gérées automatiquement.');
    }

    if (dto.categoryId) {
      await this.ensureCategoryOwnership(dto.categoryId, userId);
    }

    if (dto.linkedTransactionId) {
      await this.ensureTransactionOwnership(dto.linkedTransactionId, userId);
    }

    const amount = new Prisma.Decimal(dto.amount);

    const { transaction, account: updatedAccount } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          accountId: account.id,
          categoryId: dto.categoryId,
          date: new Date(dto.date),
          label: dto.label,
          amount,
          status: dto.status ?? TransactionStatus.NONE,
          transactionType: dto.transactionType ?? TransactionType.NONE,
          linkedTransactionId: dto.linkedTransactionId ?? null,
        },
        include: { category: { select: { id: true, name: true } } },
      });

      const accountRecord = await this.recalculateAccountBalances(tx, account.id);

      return { transaction: created, account: accountRecord };
    });

    const runningMap = await this.recalculateRunningMap(account.id, Number(account.initialBalance));
    const entity = this.toEntity(transaction, runningMap.get(transaction.id) ?? 0);
    this.events.emit('transaction.created', entity);
    this.emitAccountUpdated(updatedAccount);
    await this.recalculateBudgetMonthForUser(new Date(dto.date), userId);
    return entity;
  }

  async createInitialTransactionForAccount(
    accountId: string,
    options: {
      amount: number;
      categoryId: string;
      label?: string;
      date?: Date;
      status?: TransactionStatus;
    },
  ): Promise<TransactionEntity> {
    const userId = this.userContext.getUserId();
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    if (!options.categoryId) {
      throw new BadRequestException('Une catégorie initiale est requise.');
    }

    await this.ensureCategoryOwnership(options.categoryId, userId);

    const label = options.label ?? 'Solde initial';
    const status = options.status ?? TransactionStatus.RECONCILED;
    const eventDate = options.date ? new Date(options.date) : new Date();
    if (Number.isNaN(eventDate.getTime())) {
      throw new BadRequestException('La date fournie pour la transaction initiale est invalide.');
    }

    const decimalAmount = new Prisma.Decimal(options.amount ?? 0);

    const { transaction, account: updatedAccount } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          accountId: account.id,
          categoryId: options.categoryId,
          date: eventDate,
          label,
          amount: decimalAmount,
          status,
          transactionType: TransactionType.INITIAL,
        },
        include: { category: { select: { id: true, name: true } } },
      });

      const accountRecord = await this.recalculateAccountBalances(tx, account.id);

      return { transaction: created, account: accountRecord };
    });

    const runningMap = await this.recalculateRunningMap(account.id, Number(account.initialBalance));
    const entity = this.toEntity(transaction, runningMap.get(transaction.id) ?? 0);
    this.events.emit('transaction.created', entity);
    this.emitAccountUpdated(updatedAccount);
    await this.recalculateBudgetMonthForUser(eventDate, userId);
    return entity;
  }

  async findOne(accountId: string, transactionId: string): Promise<TransactionEntity> {
    const userId = this.userContext.getUserId();
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!transaction || transaction.accountId !== account.id) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    const runningMap = await this.recalculateRunningMap(account.id, Number(account.initialBalance));
    return this.toEntity(transaction, runningMap.get(transaction.id) ?? 0);
  }

  async recalculateBudgetMonthForUser(month: Date, userId?: string): Promise<BudgetMonth> {
    const actualUserId = userId ?? this.userContext.getUserId();
    const baseStart = this.getMonthStart(month);
    const { month: updated, months, categories } = await this.prisma.$transaction((tx) =>
      this.recalculateBudgetMonthSummary(tx, actualUserId, baseStart),
    );
    if (categories.length > 0) {
      this.emitBudgetCategoryUpdates(categories);
    }
    if (months.length > 0) {
      this.emitBudgetMonthUpdates(months);
    } else {
      this.emitBudgetMonthUpdates([this.formatMonthKey(baseStart)]);
    }
    return updated;
  }

  async update(
    accountId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionEntity> {
    const userId = this.userContext.getUserId();
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const existing = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { category: true },
    });
    if (!existing || existing.accountId !== account.id) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    const isInitial = existing.transactionType === TransactionType.INITIAL;

    if (dto.categoryId !== undefined) {
      if (isInitial && dto.categoryId !== existing.categoryId) {
        throw new BadRequestException('La catégorie de la transaction initiale ne peut pas être modifiée.');
      }
      if (dto.categoryId) {
        await this.ensureCategoryOwnership(dto.categoryId, userId);
      }
    }

    if (dto.linkedTransactionId !== undefined) {
      if (isInitial && dto.linkedTransactionId !== existing.linkedTransactionId) {
        throw new BadRequestException('Les transactions initiales ne peuvent pas être liées.');
      }
      if (dto.linkedTransactionId) {
        await this.ensureTransactionOwnership(dto.linkedTransactionId, userId);
      }
    }

    if (dto.label !== undefined && isInitial && dto.label !== existing.label) {
      throw new BadRequestException('Le libellé de la transaction initiale ne peut pas être modifié.');
    }

    if (dto.transactionType !== undefined) {
      if (isInitial && dto.transactionType !== TransactionType.INITIAL) {
        throw new BadRequestException('Le type de la transaction initiale ne peut pas être modifié.');
      }
      if (!isInitial && dto.transactionType === TransactionType.INITIAL) {
        throw new BadRequestException('Impossible de définir une transaction initiale via cette API.');
      }
    }

    const newAmount = dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : existing.amount;

    const { transaction: updated, account: updatedAccount } =
      await this.prisma.$transaction(async (tx) => {
        const txn = await tx.transaction.update({
          where: { id: transactionId },
          data: {
            categoryId: dto.categoryId ?? existing.categoryId,
            date: dto.date ? new Date(dto.date) : existing.date,
            label: dto.label ?? existing.label,
            amount: newAmount,
            status: dto.status ?? existing.status,
            transactionType: dto.transactionType ?? existing.transactionType,
            linkedTransactionId:
              dto.linkedTransactionId !== undefined
                ? dto.linkedTransactionId
                : existing.linkedTransactionId,
          },
          include: { category: { select: { id: true, name: true } } },
        });
        const accountRecord = await this.recalculateAccountBalances(tx, account.id);

        return { transaction: txn, account: accountRecord };
      });

    const runningMap = await this.recalculateRunningMap(account.id, Number(account.initialBalance));
    const entity = this.toEntity(updated, runningMap.get(updated.id) ?? 0);
    this.events.emit('transaction.updated', entity);
    this.emitAccountUpdated(updatedAccount);
    await this.recalculateBudgetMonthForUser(
      dto.date ? new Date(dto.date) : existing.date,
      userId,
    );
    return entity;
  }

  async remove(accountId: string, transactionId: string): Promise<TransactionEntity> {
    const userId = this.userContext.getUserId();
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const existing = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!existing || existing.accountId !== account.id) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    if (existing.transactionType === TransactionType.INITIAL) {
      throw new BadRequestException('Les transactions initiales sont gérées automatiquement.');
    }

    const runningBefore = await this.recalculateRunningMap(
      account.id,
      Number(account.initialBalance),
    );
    const balance = runningBefore.get(existing.id) ?? 0;

    const { account: updatedAccount } = await this.prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id: transactionId } });
      const accountRecord = await this.recalculateAccountBalances(tx, account.id);
      return { account: accountRecord };
    });

    const entity = this.toEntity(existing, balance);
    this.events.emit('transaction.deleted', { accountId, transactionId });
    this.emitAccountUpdated(updatedAccount);
    await this.recalculateBudgetMonthForUser(existing.date, userId);
    return entity;
  }

  private async recalculateAccountBalances(
    client: Prisma.TransactionClient,
    accountId: string,
  ): Promise<Account> {
    const total = await client.transaction.aggregate({
      where: { accountId },
      _sum: { amount: true },
    });

    const pointed = await client.transaction.aggregate({
      where: {
        accountId,
        status: { in: [TransactionStatus.POINTED, TransactionStatus.RECONCILED] },
      },
      _sum: { amount: true },
    });

    const reconciled = await client.transaction.aggregate({
      where: { accountId, status: TransactionStatus.RECONCILED },
      _sum: { amount: true },
    });

    const account = await client.account.update({
      where: { id: accountId },
      data: {
        currentBalance: new Prisma.Decimal(total._sum.amount ?? 0),
        pointedBalance: new Prisma.Decimal(pointed._sum.amount ?? 0),
        reconciledBalance: new Prisma.Decimal(reconciled._sum.amount ?? 0),
      },
    });

    return account;
  }

  private emitAccountUpdated(account: Account | null) {
    if (!account) {
      return;
    }
    const entity = this.toAccountEntity(account);
    this.events.emit('account.updated', entity);
  }

  private toAccountEntity(account: Account): AccountEntity {
    return plainToInstance(AccountEntity, {
      ...account,
      initialBalance: Number(account.initialBalance),
      currentBalance: Number(account.currentBalance),
      pointedBalance: Number(account.pointedBalance),
      reconciledBalance: Number(account.reconciledBalance),
    });
  }

  private async ensureBudgetCategoryStructure(
    client: Prisma.TransactionClient,
    userId: string,
    categoryId: string,
    monthStart: Date,
    topLevelCache: Map<string, string>,
  ): Promise<BudgetCategory> {
    const month = await client.budgetMonth.upsert({
      where: { userId_month: { userId, month: monthStart } },
      update: {},
      create: {
        userId,
        month: monthStart,
        availableCarryover: new Prisma.Decimal(0),
        income: new Prisma.Decimal(0),
        assigned: new Prisma.Decimal(0),
        available: new Prisma.Decimal(0),
        activity: new Prisma.Decimal(0),
      },
    });

    const topLevelId = await this.resolveTopLevelCategoryId(
      client,
      categoryId,
      topLevelCache,
    );

    const group = await client.budgetCategoryGroup.upsert({
      where: { monthId_categoryId: { monthId: month.id, categoryId: topLevelId } },
      update: {},
      create: { monthId: month.id, categoryId: topLevelId },
    });

    const budgetCategory = await client.budgetCategory.upsert({
      where: { groupId_categoryId: { groupId: group.id, categoryId } },
      update: {},
      create: {
        groupId: group.id,
        categoryId,
        assigned: new Prisma.Decimal(0),
        activity: new Prisma.Decimal(0),
        available: new Prisma.Decimal(0),
      },
    });

    return budgetCategory;
  }

  private async recalculateBudgetMonthSummary(
    client: Prisma.TransactionClient,
    userId: string,
    monthStart: Date,
  ): Promise<{
    month: BudgetMonth;
    months: Array<string>;
    categories: Array<{ month: string; category: BudgetCategoryEntity }>;
  }> {
    const baseStart = this.getMonthStart(monthStart);

    await client.budgetMonth.upsert({
      where: { userId_month: { userId, month: baseStart } },
      update: {},
      create: {
        userId,
        month: baseStart,
        availableCarryover: new Prisma.Decimal(0),
        income: new Prisma.Decimal(0),
        assigned: new Prisma.Decimal(0),
        available: new Prisma.Decimal(0),
        activity: new Prisma.Decimal(0),
      },
    });

    const months = await client.budgetMonth.findMany({
      where: { userId },
      orderBy: { month: 'asc' },
    });

    const monthsToReload: Array<string> = [];
    const categoryEvents: Array<{ month: string; category: BudgetCategoryEntity }> = [];
    const cumulativeCategoryAvailable = new Map<string, Prisma.Decimal>();
    const topLevelCache = new Map<string, string>();
    const monthByKey = new Map<string, BudgetMonth>();
    const targetKey = this.formatMonthKey(baseStart);
    let targetMonth: BudgetMonth | null = null;
    let previousAvailable = new Prisma.Decimal(0);

    for (const monthRecord of months) {
      const currentStart = this.getMonthStart(monthRecord.month);
      const monthKey = this.formatMonthKey(currentStart);
      const nextStart = this.getNextMonth(currentStart);
      const previousStart = this.getPreviousMonth(currentStart);

      const incomeCurrent = await client.transaction.aggregate({
        where: {
          account: { userId },
          date: { gte: currentStart, lt: nextStart },
          category: { kind: { in: [CategoryKind.INCOME, CategoryKind.INITIAL] } },
        },
        _sum: { amount: true },
      });

      const incomePrevious = await client.transaction.aggregate({
        where: {
          account: { userId },
          date: { gte: previousStart, lt: currentStart },
          category: { kind: CategoryKind.INCOME_PLUS_ONE },
        },
        _sum: { amount: true },
      });

      const incomeTotal = new Prisma.Decimal(incomeCurrent._sum.amount ?? 0).plus(
        new Prisma.Decimal(incomePrevious._sum.amount ?? 0),
      );

      const assignedAggregate = await client.budgetCategory.aggregate({
        where: { group: { monthId: monthRecord.id } },
        _sum: { assigned: true },
      });
      const assigned = new Prisma.Decimal(assignedAggregate._sum.assigned ?? 0);

      const activityAggregate = await client.transaction.aggregate({
        where: {
          account: { userId },
          date: { gte: currentStart, lt: nextStart },
          transactionType: TransactionType.NONE,
          category: { kind: CategoryKind.EXPENSE },
        },
        _sum: { amount: true },
      });
      const activity = new Prisma.Decimal(activityAggregate._sum.amount ?? 0);

      const availableCarryover = previousAvailable;
      const available = incomeTotal.plus(availableCarryover).minus(assigned);

      const updatedMonth = await client.budgetMonth.update({
        where: { id: monthRecord.id },
        data: {
          income: incomeTotal,
          availableCarryover,
          assigned,
          activity,
          available,
        },
      });

      monthsToReload.push(monthKey);
      monthByKey.set(monthKey, updatedMonth);
      if (monthKey === targetKey) {
        targetMonth = updatedMonth;
      }

      const expenseTransactions = await client.transaction.findMany({
        where: {
          account: { userId },
          date: { gte: currentStart, lt: nextStart },
          category: { kind: CategoryKind.EXPENSE },
        },
        select: { categoryId: true },
      });

      const requiredExpenseCategories = new Set<string>();
      for (const txn of expenseTransactions) {
        if (txn.categoryId) {
          requiredExpenseCategories.add(txn.categoryId);
        }
      }

      for (const categoryId of requiredExpenseCategories) {
        await this.ensureBudgetCategoryStructure(
          client,
          userId,
          categoryId,
          currentStart,
          topLevelCache,
        );
      }

      const budgetCategories = await client.budgetCategory.findMany({
        where: { group: { monthId: monthRecord.id } },
        include: { category: true },
      });

      for (const budgetCategory of budgetCategories) {
        const activityAggregateForCategory = await client.transaction.aggregate({
          where: {
            account: { userId },
            categoryId: budgetCategory.categoryId,
            date: { gte: currentStart, lt: nextStart },
            transactionType: TransactionType.NONE,
            category: { kind: CategoryKind.EXPENSE },
          },
          _sum: { amount: true },
        });

        const categoryActivity = new Prisma.Decimal(
          activityAggregateForCategory._sum.amount ?? 0,
        );
        const categoryAssigned = new Prisma.Decimal(budgetCategory.assigned ?? 0);
        const previousCategoryTotal =
          cumulativeCategoryAvailable.get(budgetCategory.categoryId) ??
          new Prisma.Decimal(0);
        const categoryAvailable = previousCategoryTotal.plus(categoryAssigned).plus(categoryActivity);

        const updatedCategory = await client.budgetCategory.update({
          where: { id: budgetCategory.id },
          data: {
            activity: categoryActivity,
            available: categoryAvailable,
          },
          include: { category: true },
        });

        cumulativeCategoryAvailable.set(budgetCategory.categoryId, categoryAvailable);
        categoryEvents.push({
          month: monthKey,
          category: this.toBudgetCategoryEntity(updatedCategory),
        });
      }

      previousAvailable = available;
    }

    if (!targetMonth) {
      targetMonth = monthByKey.get(targetKey) ?? months[months.length - 1];
    }

    return {
      month: targetMonth!,
      months: monthsToReload,
      categories: categoryEvents,
    };
  }

  private async resolveTopLevelCategoryId(
    client: Prisma.TransactionClient,
    categoryId: string,
    cache: Map<string, string>,
  ): Promise<string> {
    if (cache.has(categoryId)) {
      return cache.get(categoryId)!;
    }

    let currentId = categoryId;
    while (true) {
      const category = await client.category.findUnique({
        where: { id: currentId },
        select: { parentCategoryId: true },
      });

      if (!category || !category.parentCategoryId) {
        cache.set(categoryId, currentId);
        return currentId;
      }

      currentId = category.parentCategoryId;
    }
  }

  private emitBudgetCategoryUpdates(
    categories: Array<{ month: string; category: BudgetCategoryEntity }>,
  ) {
    const dedup = new Map<string, { month: string; category: BudgetCategoryEntity }>();
    for (const entry of categories) {
      dedup.set(`${entry.month}:${entry.category.id}`, entry);
    }
    dedup.forEach((payload) => this.events.emit('budget.category.updated', payload));
  }

  private emitBudgetMonthUpdates(months: Array<string>) {
    const unique = Array.from(new Set(months));
    unique.forEach((month) => this.events.emit('budget.month.updated', { month }));
  }

  private toBudgetCategoryEntity(category: {
    [key: string]: any;
  }): BudgetCategoryEntity {
    const {
      id,
      groupId,
      categoryId,
      assigned,
      activity,
      available,
      createdAt,
      updatedAt,
      category: relatedCategory,
    } = category;

    const categoryEntity = relatedCategory
      ? plainToInstance(CategoryEntity, {
          ...relatedCategory,
          sortOrder: Number(relatedCategory.sortOrder ?? 0),
        })
      : undefined;

    return plainToInstance(BudgetCategoryEntity, {
      id,
      groupId,
      categoryId,
      category: categoryEntity,
      assigned: Number(assigned ?? 0),
      activity: Number(activity ?? 0),
      available: Number(available ?? 0),
      requiredAmount: 0,
      optimizedAmount: 0,
      createdAt,
      updatedAt,
    });
  }

  private getMonthStart(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private getNextMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  }

  private getPreviousMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  }

  private formatMonthKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private computeRunningBalances(
    ledger: Array<Pick<Transaction, 'id' | 'amount' | 'date' | 'createdAt' | 'transactionType'>>,
    initialBalance: number,
  ): Map<string, number> {
    const map = new Map<string, number>();
    let running = initialBalance;
    for (const entry of ledger) {
      if (entry.transactionType === TransactionType.INITIAL) {
        running = Number(entry.amount);
      } else {
        running += Number(entry.amount);
      }
      map.set(entry.id, running);
    }
    return map;
  }

  private async recalculateRunningMap(accountId: string, initialBalance: number) {
    const ledger = await this.prisma.transaction.findMany({
      where: { accountId },
      select: { id: true, amount: true, date: true, createdAt: true, transactionType: true },
      orderBy: [
        { date: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    return this.computeRunningBalances(ledger, initialBalance);
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

  private async ensureTransactionOwnership(transactionId: string, userId: string) {
    const txn = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        account: { userId },
      },
      select: { id: true },
    });
    if (!txn) {
      throw new NotFoundException(`Linked transaction ${transactionId} not found`);
    }
  }

  private toEntity(
    transaction: Transaction & { category?: { id: string | null; name: string | null } | null },
    runningBalance: number,
  ): TransactionEntity {
    const amount = Number(transaction.amount);
    const debit = amount < 0 ? Math.abs(amount) : undefined;
    const credit = amount > 0 ? amount : undefined;

    return plainToInstance(TransactionEntity, {
      ...transaction,
      date: transaction.date.toISOString(),
      amount,
      debit,
      credit,
      balance: runningBalance,
      categoryId: transaction.category?.id ?? transaction.categoryId ?? null,
      categoryName: transaction.category?.name ?? null,
      status: transaction.status,
      transactionType: transaction.transactionType,
      linkedTransactionId: transaction.linkedTransactionId ?? null,
    });
  }
}
