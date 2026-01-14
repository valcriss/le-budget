import { strict as assert } from 'assert';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoryKind, Prisma, TransactionType } from '@prisma/client';
import { BudgetService } from '../src/modules/budget/budget.service';

type MonthRecord = {
  id: string;
  userId: string;
  month: Date;
  availableCarryover: number;
  income: number;
  assigned: number;
  activity: number;
  available: number;
  createdAt: Date;
  updatedAt: Date;
};

type BudgetGroupRecord = {
  id: string;
  monthId: string;
  categoryId: string;
};

type BudgetCategoryRecord = {
  id: string;
  groupId: string;
  categoryId: string;
  assigned: number;
  activity: number;
  available: number;
  createdAt: Date;
  updatedAt: Date;
};

type CategoryRecord = {
  id: string;
  userId: string;
  name: string;
  sortOrder: number;
  kind: string;
  parentCategoryId: string | null;
};

type TransactionRecord = {
  id: string;
  accountUserId: string;
  categoryId: string;
  categoryKind: string;
  date: Date;
  amount: number;
  transactionType: string;
};

class StubEventsService {
  public readonly emitted: Array<{ event: string; payload: unknown }> = [];

  emit(event: string, payload: unknown) {
    this.emitted.push({ event, payload });
  }
}

class StubTransactionsService {
  public readonly calls: Array<{ month: Date; userId: string }> = [];

  constructor(private readonly prisma: FakeBudgetPrisma) {}

  async recalculateBudgetMonthForUser(month: Date, userId: string) {
    this.calls.push({ month, userId });
    const record = this.prisma.findMonthByUserAndDate(userId, month);
    if (!record) {
      throw new Error('Month not found in stub');
    }
    return {
      ...record,
      availableCarryover: new Prisma.Decimal(record.availableCarryover),
      income: new Prisma.Decimal(record.income),
      assigned: new Prisma.Decimal(record.assigned),
      activity: new Prisma.Decimal(record.activity),
      available: new Prisma.Decimal(record.available),
    };
  }
}

class StubUserContext {
  constructor(private readonly userId: string) {}

  getUserId() {
    return this.userId;
  }
}

let groupCounter = 1;
let budgetCounter = 1;

class FakeBudgetPrisma {
  private readonly months = new Map<string, MonthRecord>();
  private readonly groups = new Map<string, BudgetGroupRecord>();
  private readonly budgetCategories = new Map<string, BudgetCategoryRecord>();
  private readonly categories = new Map<string, CategoryRecord>();
  private readonly transactions: TransactionRecord[] = [];

  public readonly createdGroups: BudgetGroupRecord[] = [];
  public readonly createdBudgetCategories: BudgetCategoryRecord[] = [];

  constructor(seedDefaultMonth = false) {
    if (seedDefaultMonth) {
      const month: MonthRecord = {
        id: 'month-2025-01',
        userId: 'user-123',
        month: new Date(Date.UTC(2025, 0, 1)),
        availableCarryover: 0,
        income: 0,
        assigned: 0,
        activity: 0,
        available: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.months.set(month.id, month);

      this.addCategory({
        id: 'cat-1',
        userId: 'user-123',
        name: 'Courses',
        sortOrder: 0,
        kind: 'EXPENSE',
        parentCategoryId: 'parent-expense',
      });
      this.addCategory({
        id: 'parent-expense',
        userId: 'user-123',
        name: 'Dépenses',
        sortOrder: 0,
        kind: 'EXPENSE',
        parentCategoryId: null,
      });

      const group: BudgetGroupRecord = {
        id: 'group-1',
        monthId: month.id,
        categoryId: 'parent-expense',
      };
      this.groups.set(group.id, group);

      const budget: BudgetCategoryRecord = {
        id: 'budget-cat-1',
        groupId: group.id,
        categoryId: 'cat-1',
        assigned: 50,
        activity: -25,
        available: 25,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.budgetCategories.set(budget.id, budget);
    }
  }

  private cloneMonth(month: MonthRecord): MonthRecord {
    return { ...month, month: new Date(month.month), createdAt: new Date(month.createdAt), updatedAt: new Date(month.updatedAt) };
  }

  formatIdFromDate(date: Date): string {
    return `month-${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  findMonthByUserAndDate(userId: string, date: Date): MonthRecord | null {
    for (const month of this.months.values()) {
      if (month.userId === userId && month.month.getTime() === date.getTime()) {
        return this.cloneMonth(month);
      }
    }
    return null;
  }

  addCategory(category: CategoryRecord) {
    this.categories.set(category.id, { ...category });
  }

  addTransaction(txn: TransactionRecord) {
    this.transactions.push({ ...txn });
  }

  get budgetMonth() {
    return {
      findFirst: async ({ where }: { where: any }) => {
        if (where.id) {
          const record = this.months.get(where.id);
          return record ? this.cloneMonth(record) : null;
        }
        if (where.userId) {
          const { userId, month } = where;
          const gte = month?.gte?.getTime();
          const lt = month?.lt?.getTime();
          for (const record of this.months.values()) {
            const time = record.month.getTime();
            if (record.userId === userId) {
              if (gte !== undefined && lt !== undefined) {
                if (time >= gte && time < lt) {
                  return this.cloneMonth(record);
                }
              }
            }
          }
        }
        return null;
      },

      create: async ({ data }: { data: any }) => {
        const id = this.formatIdFromDate(data.month);
        const month: MonthRecord = {
          id,
          userId: data.userId,
          month: new Date(data.month),
          availableCarryover: Number(data.availableCarryover),
          income: Number(data.income),
          assigned: Number(data.assigned),
          activity: Number(data.activity),
          available: Number(data.available),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.months.set(month.id, month);
        return this.cloneMonth(month);
      },

      update: async ({ where, data }: { where: { id: string }; data: any }) => {
        const record = this.months.get(where.id);
        if (!record) {
          throw new Error('Month not found for update');
        }
        if (data.month) {
          record.month = new Date(data.month);
        }
        record.updatedAt = new Date();
        return this.cloneMonth(record);
      },
    };
  }

  get budgetCategoryGroup() {
    return {
      findMany: async ({ where, select, include }: { where: { monthId: string }; select?: { id?: boolean; categoryId?: boolean }; include?: { category?: boolean; categories?: any } }) => {
        const groups = Array.from(this.groups.values()).filter((group) => group.monthId === where.monthId);

        if (select) {
          return groups.map((group) => {
            const result: any = {};
            if (select.id) result.id = group.id;
            if (select.categoryId) result.categoryId = group.categoryId;
            return result;
          });
        }

        return groups.map((group) => {
          const result: any = { ...group };
          if (include?.category) {
            const category = this.categories.get(group.categoryId) ?? null;
            result.category = category ? { ...category } : null;
          }
          if (include?.categories) {
            const childBudgets = Array.from(this.budgetCategories.values()).filter((budget) => budget.groupId === group.id);
            result.categories = childBudgets.map((budget) => ({
              ...budget,
              category: this.categories.get(budget.categoryId)
                ? { ...this.categories.get(budget.categoryId)! }
                : null,
            }));
          }
          return result;
        });
      },

      create: async ({ data }: { data: { monthId: string; categoryId: string } }) => {
        const record: BudgetGroupRecord = {
          id: `group-${groupCounter++}`,
          monthId: data.monthId,
          categoryId: data.categoryId,
        };
        this.groups.set(record.id, record);
        this.createdGroups.push({ ...record });
        return { ...record };
      },
    };
  }

  get budgetCategory() {
    return {
      findFirst: async ({ where }: { where: { categoryId: string; group: { monthId: string } } }) => {
        for (const group of this.groups.values()) {
          if (group.monthId !== where.group.monthId) {
            continue;
          }
          const match = Array.from(this.budgetCategories.values()).find(
            (entry) => entry.groupId === group.id && entry.categoryId === where.categoryId,
          );
          if (match) {
            const category = this.categories.get(match.categoryId);
            return {
              ...match,
              category,
            };
          }
        }
        return null;
      },

      findMany: async ({ where, select }: { where: { groupId?: string; group?: { monthId: string } }; select?: { categoryId?: boolean } }) => {
        let items = Array.from(this.budgetCategories.values());
        if (where.groupId) {
          items = items.filter((item) => item.groupId === where.groupId);
        }
        if (where.group?.monthId) {
          items = items.filter(
            (item) => this.groups.get(item.groupId)?.monthId === where.group!.monthId,
          );
        }
        return items.map((item) => {
          if (!select) {
            return { ...item };
          }
          const result: any = {};
          if (select.categoryId) {
            result.categoryId = item.categoryId;
          }
          return result;
        });
      },

      create: async ({ data }: { data: any }) => {
        const record: BudgetCategoryRecord = {
          id: `budget-${budgetCounter++}`,
          groupId: data.groupId,
          categoryId: data.categoryId,
          assigned: Number(data.assigned),
          activity: Number(data.activity),
          available: Number(data.available),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.budgetCategories.set(record.id, record);
        this.createdBudgetCategories.push({ ...record });
        return { ...record };
      },

      update: async ({ where, data }: { where: { id: string }; data: { assigned?: Prisma.Decimal; activity?: Prisma.Decimal; available?: Prisma.Decimal } }) => {
        const record = this.budgetCategories.get(where.id);
        if (!record) {
          throw new Error('Budget category not found');
        }
        if (data.assigned !== undefined) {
          record.assigned = Number(data.assigned);
        }
        if (data.activity !== undefined) {
          record.activity = Number(data.activity);
        }
        if (data.available !== undefined) {
          record.available = Number(data.available);
        }
        record.updatedAt = new Date();
        const category = this.categories.get(record.categoryId);
        return { ...record, category };
      },
    };
  }

  get category() {
    return {
      findMany: async ({ where, include, orderBy }: { where?: any; include?: any; orderBy?: Array<{ sortOrder?: 'asc' | 'desc'; name?: 'asc' | 'desc' }> } = {}) => {
        let items = Array.from(this.categories.values());
        if (where?.userId) {
          items = items.filter((item) => item.userId === where.userId);
        }
        if (where?.kind) {
          items = items.filter((item) => item.kind === where.kind);
        }
        if (where?.parentCategoryId !== undefined) {
          items = items.filter((item) => item.parentCategoryId === where.parentCategoryId);
        }
        if (where?.id?.in) {
          const allowed = new Set(where.id.in);
          items = items.filter((item) => allowed.has(item.id));
        }

        if (orderBy) {
          for (const rule of orderBy.reverse()) {
            if (rule.sortOrder) {
              items.sort((a, b) =>
                rule.sortOrder === 'asc' ? a.sortOrder - b.sortOrder : b.sortOrder - a.sortOrder,
              );
            } else if (rule.name) {
              items.sort((a, b) =>
                rule.name === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
              );
            }
          }
        }

        return items.map((item) => {
          const base: any = { ...item };
          if (include?.subCategories) {
            const children = Array.from(this.categories.values()).filter(
              (candidate) => candidate.parentCategoryId === item.id,
            );
            let filtered = children;
            const subWhere = include.subCategories.where;
            if (subWhere?.userId) {
              filtered = filtered.filter((child) => child.userId === subWhere.userId);
            }
            if (subWhere?.kind) {
              filtered = filtered.filter((child) => child.kind === subWhere.kind);
            }
            filtered.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
            base.subCategories = filtered.map((child) => ({ ...child }));
          }
          return base;
        });
      },
    };
  }

  get transaction() {
    return {
      findMany: async ({ where, select, orderBy }: { where?: any; select?: any; orderBy?: any }) => {
        let items = [...this.transactions];
        if (where?.account?.userId) {
          items = items.filter((item) => item.accountUserId === where.account.userId);
        }
        if (where?.categoryId?.in) {
          const allowed = new Set(where.categoryId.in);
          items = items.filter((item) => allowed.has(item.categoryId));
        }
        if (where?.category?.kind) {
          const kind = where.category.kind;
          if (kind?.in) {
            const allowed = new Set(kind.in);
            items = items.filter((item) => allowed.has(item.categoryKind));
          } else {
            items = items.filter((item) => item.categoryKind === kind);
          }
        }
        if (where?.transactionType) {
          items = items.filter((item) => item.transactionType === where.transactionType);
        }
        if (where?.amount?.lt !== undefined) {
          items = items.filter((item) => item.amount < where.amount.lt);
        }
        if (where?.date?.gte || where?.date?.lt) {
          const gte = where.date.gte?.getTime();
          const lt = where.date.lt?.getTime();
          items = items.filter((item) => {
            const time = item.date.getTime();
            if (gte !== undefined && time < gte) {
              return false;
            }
            if (lt !== undefined && time >= lt) {
              return false;
            }
            return true;
          });
        }
        if (orderBy?.date) {
          items.sort((a, b) =>
            orderBy.date === 'asc' ? a.date.getTime() - b.date.getTime() : b.date.getTime() - a.date.getTime(),
          );
        }

        if (!select) {
          return items.map((item) => ({ ...item }));
        }
        return items.map((item) => {
          const result: any = {};
          if (select.categoryId) {
            result.categoryId = item.categoryId;
          }
          if (select.amount) {
            result.amount = item.amount;
          }
          if (select.date) {
            result.date = new Date(item.date);
          }
          return result;
        });
      },
    };
  }
}

function createBudgetService(prisma: FakeBudgetPrisma) {
  const events = new StubEventsService();
  const transactions = new StubTransactionsService(prisma);
  const userContext = new StubUserContext('user-123');
  const service = new BudgetService(prisma as any, events as any, userContext as any, transactions as any);
  return { service, events, transactions };
}

async function testUpdateCategoryRecomputesAvailable() {
  const prisma = new FakeBudgetPrisma(true);
  const { service, events, transactions } = createBudgetService(prisma);

  const result = await service.updateCategory('month-2025-01', 'cat-1', {
    assigned: 120,
    activity: -50,
  });

  assert.equal(result.assigned, 120);
  assert.equal(result.activity, -50);
  assert.equal(result.available, 70);
  assert.equal(events.emitted.length, 1);
  assert.equal(events.emitted[0].event, 'budget.category.updated');
  assert.equal(transactions.calls.length, 1);
  assert.equal(transactions.calls[0].month.getUTCFullYear(), 2025);
}

async function testMonthStringToDateValidation() {
  const prisma = new FakeBudgetPrisma();
  const { service } = createBudgetService(prisma);

  const convert = (service as any).monthStringToDate.bind(service);
  const valid = convert('2025-02');
  assert.equal(valid.getUTCMonth(), 1);

  assert.throws(() => convert('2025/02'), BadRequestException);
}

async function testGetMonthCreatesStructure() {
  const prisma = new FakeBudgetPrisma();
  prisma.addCategory({
    id: 'parent-empty',
    userId: 'user-123',
    name: 'Sans enfants',
    sortOrder: 0,
    kind: 'EXPENSE',
    parentCategoryId: null,
  });
  prisma.addCategory({
    id: 'parent-logement',
    userId: 'user-123',
    name: 'Logement',
    sortOrder: 1,
    kind: 'EXPENSE',
    parentCategoryId: null,
  });
  prisma.addCategory({
    id: 'child-rent',
    userId: 'user-123',
    name: 'Loyer',
    sortOrder: 0,
    kind: 'EXPENSE',
    parentCategoryId: 'parent-logement',
  });

  const { service, transactions } = createBudgetService(prisma);

  const month = await service.getMonth('2025-03');

  assert.equal(month.month, '2025-03');
  assert.equal(month.groups.length, 2);
  const housingGroup = month.groups.find((group) => group.categoryId === 'parent-logement');
  assert(housingGroup, 'Housing group should exist');
  assert.equal(housingGroup!.items.length, 1);
  assert.equal(housingGroup!.items[0].categoryId, 'child-rent');
  const emptyGroup = month.groups.find((group) => group.categoryId === 'parent-empty');
  assert(emptyGroup, 'Empty group should exist');
  assert.equal(emptyGroup!.items.length, 0);
  assert.equal(prisma.createdGroups.length, 2);
  assert.equal(prisma.createdBudgetCategories.length, 1);
  assert.equal(transactions.calls.length, 2); // ensureMonthStructure + final recalculation
}

async function testGetMonthComputesRequiredAndOptimized() {
  const prisma = new FakeBudgetPrisma(true);
  prisma.addTransaction({
    id: 'txn-jan',
    accountUserId: 'user-123',
    categoryId: 'cat-1',
    categoryKind: CategoryKind.EXPENSE,
    date: new Date(Date.UTC(2025, 0, 5)),
    amount: -50,
    transactionType: TransactionType.NONE,
  });
  prisma.addTransaction({
    id: 'txn-aug',
    accountUserId: 'user-123',
    categoryId: 'cat-1',
    categoryKind: CategoryKind.EXPENSE,
    date: new Date(Date.UTC(2025, 7, 15)),
    amount: -500,
    transactionType: TransactionType.NONE,
  });
  prisma.addTransaction({
    id: 'txn-dec',
    accountUserId: 'user-123',
    categoryId: 'cat-1',
    categoryKind: CategoryKind.EXPENSE,
    date: new Date(Date.UTC(2025, 11, 20)),
    amount: -700,
    transactionType: TransactionType.NONE,
  });

  const { service } = createBudgetService(prisma);

  const month = await service.getMonth('2025-01');
  const item = month.groups[0].items[0];
  assert.equal(item.requiredAmount, 50);
  assert.equal(item.optimizedAmount, 167.7084);
}


async function testUpdateCategoryNoChangesReturnsEntity() {
  const prisma = new FakeBudgetPrisma(true);
  const { service, events, transactions } = createBudgetService(prisma);

  const result = await service.updateCategory('month-2025-01', 'cat-1', {} as any);

  assert.equal(result.id, 'budget-cat-1');
  assert.equal(events.emitted.length, 0);
  assert.equal(transactions.calls.length, 0);
}

async function testUpdateCategoryThrowsWhenMissing() {
  const prisma = new FakeBudgetPrisma(true);
  const { service } = createBudgetService(prisma);

  await assert.rejects(
    () => service.updateCategory('month-2025-01', 'missing', {} as any),
    NotFoundException,
  );
}

async function testUpdateCategoryUsesAvailableWhenProvided() {
  const prisma = new FakeBudgetPrisma(true);
  const { service, events, transactions } = createBudgetService(prisma);

  const result = await service.updateCategory('month-2025-01', 'cat-1', {
    available: 99,
  });

  assert.equal(result.available, 99);
  assert.equal(events.emitted.length, 1);
  assert.equal(transactions.calls.length, 1);
}

async function testEnsureMonthStructureSkipsRecalculateWhenNoNewCategories() {
  const prisma = new FakeBudgetPrisma(true);
  const { service, transactions } = createBudgetService(prisma);
  const month = prisma.findMonthByUserAndDate('user-123', new Date(Date.UTC(2025, 0, 1)));
  assert(month, 'Expected seed month to exist');

  await (service as any).ensureMonthStructure(month, 'user-123');

  assert.equal(prisma.createdBudgetCategories.length, 0);
  assert.equal(transactions.calls.length, 0);
}

async function testGetOrCreateMonthUsesIdMatch() {
  const prisma = new FakeBudgetPrisma(true);
  const { service } = createBudgetService(prisma);

  const result = await (service as any).getOrCreateMonth('month-2025-01', 'user-123');

  assert.equal(result.created, false);
  assert.equal(result.month.id, 'month-2025-01');
}

async function testIsSameMonthHelper() {
  const prisma = new FakeBudgetPrisma();
  const { service } = createBudgetService(prisma);

  const isSameMonth = (service as any).isSameMonth.bind(service);
  const a = new Date(Date.UTC(2025, 0, 1));
  const b = new Date(Date.UTC(2025, 0, 31));
  const c = new Date(Date.UTC(2025, 1, 1));

  assert.equal(isSameMonth(a, b), true);
  assert.equal(isSameMonth(a, c), false);
}


async function testUpdateCategoryUsesAssignedFallback() {
  const prisma = new FakeBudgetPrisma(true);
  const { service } = createBudgetService(prisma);

  const result = await service.updateCategory('month-2025-01', 'cat-1', {
    activity: -30,
  });

  assert.equal(result.available, 20);
}

async function testUpdateCategoryUsesActivityFallback() {
  const prisma = new FakeBudgetPrisma(true);
  const { service } = createBudgetService(prisma);

  const result = await service.updateCategory('month-2025-01', 'cat-1', {
    assigned: 80,
  });

  assert.equal(result.available, 55);
}

async function testGetOrCreateMonthUpdatesMismatchedMonth() {
  const baseMonth = new Date(Date.UTC(2025, 1, 1));
  const existingMonth = {
    id: 'month-legacy',
    userId: 'user-123',
    month: new Date(Date.UTC(2025, 0, 1)),
    availableCarryover: 0,
    income: 0,
    assigned: 0,
    activity: 0,
    available: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = {
    updated: null as any,
    budgetMonth: {
      findFirst: async ({ where }: { where: any }) => {
        if (where.id) {
          return null;
        }
        return { ...existingMonth };
      },
      create: async () => {
        throw new Error('Unexpected create');
      },
      update: async ({ where, data }: { where: { id: string }; data: { month: Date } }) => {
        const record = { ...existingMonth, id: where.id, month: new Date(data.month) };
        (prisma as any).updated = record;
        return record;
      },
    },
  };
  const events = { emit: () => undefined };
  const userContext = { getUserId: () => 'user-123' };
  const transactions = { recalculateBudgetMonthForUser: async () => undefined };
  const service = new BudgetService(prisma as any, events as any, userContext as any, transactions as any);

  const result = await (service as any).getOrCreateMonth('2025-02', 'user-123');

  assert.equal(result.created, false);
  assert.equal((prisma as any).updated.month.getUTCMonth(), baseMonth.getUTCMonth());
}

(async () => {
  await testUpdateCategoryRecomputesAvailable();
  await testUpdateCategoryNoChangesReturnsEntity();
  await testUpdateCategoryThrowsWhenMissing();
  await testUpdateCategoryUsesAvailableWhenProvided();
  await testUpdateCategoryUsesAssignedFallback();
  await testUpdateCategoryUsesActivityFallback();
  await testMonthStringToDateValidation();
  await testGetMonthCreatesStructure();
  await testGetMonthComputesRequiredAndOptimized();
  await testEnsureMonthStructureSkipsRecalculateWhenNoNewCategories();
  await testGetOrCreateMonthUsesIdMatch();
  await testGetOrCreateMonthUpdatesMismatchedMonth();
  await testIsSameMonthHelper();
  console.log('Budget service tests passed ✓');
})();
