import { Prisma, CategoryKind, TransactionType, TransactionStatus } from '@prisma/client';

type DecimalValue = Prisma.Decimal | number | string;

interface MockBudgetMonth {
  id: string;
  userId: string;
  month: Date;
  income: number;
  availableCarryover: number;
  assigned: number;
  activity: number;
  available: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MockBudgetCategoryGroup {
  id: string;
  monthId: string;
  categoryId: string;
}

interface MockBudgetCategory {
  id: string;
  groupId: string;
  categoryId: string;
  assigned: number;
  activity: number;
  available: number;
}

interface MockTransaction {
  id: string;
  accountId: string;
  accountUserId: string;
  categoryId: string | null;
  categoryKind: CategoryKind | null;
  date: Date;
  amount: number;
  transactionType: TransactionType;
  status: TransactionStatus;
}

interface MockCategory {
  id: string;
  userId: string;
  kind: CategoryKind;
  parentCategoryId: string | null;
  sortOrder?: number;
}

interface MockPrismaData {
  budgetMonths: MockBudgetMonth[];
  budgetCategoryGroups: MockBudgetCategoryGroup[];
  budgetCategories: MockBudgetCategory[];
  transactions: MockTransaction[];
  categories?: MockCategory[];
}

function toNumber(value: DecimalValue | null | undefined): number {
  if (value == null) return 0;
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  if (typeof value === 'string') {
    return Number(value);
  }
  return value;
}

function toDecimal(value: DecimalValue): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return value;
  }
  return new Prisma.Decimal(value ?? 0);
}

export class MockPrismaClient {
  private readonly monthsById = new Map<string, MockBudgetMonth>();
  private readonly groupsById = new Map<string, MockBudgetCategoryGroup>();
  private readonly groupByComposite = new Map<string, MockBudgetCategoryGroup>();
  private readonly budgetCategoriesTable: MockBudgetCategory[] = [];
  private readonly budgetCategoryIndex = new Map<string, MockBudgetCategory>();
  private readonly transactions: MockTransaction[] = [];
  private readonly categories = new Map<string, MockCategory>();

  constructor(data: MockPrismaData) {
    data.budgetMonths.forEach((month) => {
      this.monthsById.set(month.id, { ...month });
    });
    data.budgetCategoryGroups.forEach((group) => {
      this.groupsById.set(group.id, { ...group });
      const key = `${group.monthId}|${group.categoryId}`;
      this.groupByComposite.set(key, { ...group });
    });
    data.budgetCategories.forEach((category) => {
      const record = { ...category };
      this.budgetCategoriesTable.push(record);
      const key = `${category.groupId}|${category.categoryId}`;
      this.budgetCategoryIndex.set(key, record);
    });
    data.transactions.forEach((transaction) => {
      this.transactions.push({ ...transaction });
    });
    (data.categories ?? []).forEach((category) => {
      this.categories.set(category.id, { ...category });
    });
  }

  getBudgetCategory(id: string): MockBudgetCategory | undefined {
    const found = this.budgetCategoriesTable.find((category) => category.id === id);
    return found ? { ...found } : undefined;
  }

  async $transaction<T>(fn: (client: this) => Promise<T>): Promise<T> {
    return fn(this);
  }

  getMonth(id: string): MockBudgetMonth | undefined {
    const month = this.monthsById.get(id);
    return month ? { ...month } : undefined;
  }

  private findMonthByUserAndDate(userId: string, month: Date): MockBudgetMonth | undefined {
    const targetTime = month.getTime();
    for (const candidate of this.monthsById.values()) {
      if (candidate.userId === userId && candidate.month.getTime() === targetTime) {
        return candidate;
      }
    }
    return undefined;
  }

  private cloneMonth(month: MockBudgetMonth) {
    return { ...month };
  }

  budgetMonth = {
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { userId_month: { userId: string; month: Date } } | { id: string };
      create: {
        userId: string;
        month: Date;
        availableCarryover: DecimalValue;
        income: DecimalValue;
        assigned: DecimalValue;
        available: DecimalValue;
        activity: DecimalValue;
      };
      update: Partial<Record<'availableCarryover' | 'income' | 'assigned' | 'available' | 'activity', DecimalValue>>;
    }) => {
      if ('userId_month' in where) {
        const existing = this.findMonthByUserAndDate(where.userId_month.userId, where.userId_month.month);
        if (existing) {
          Object.assign(existing, {
            ...existing,
            ...Object.entries(update).reduce<Record<string, number>>((acc, [key, value]) => {
              acc[key] = toNumber(value);
              return acc;
            }, {}),
          });
          return this.cloneMonth(existing);
        }
        const id = `mock-month-${Math.random().toString(36).slice(2, 11)}`;
        const created: MockBudgetMonth = {
          id,
          userId: create.userId,
          month: new Date(create.month),
          availableCarryover: toNumber(create.availableCarryover),
          income: toNumber(create.income),
          assigned: toNumber(create.assigned),
          activity: toNumber(create.activity),
          available: toNumber(create.available),
        };
        this.monthsById.set(created.id, created);
        return this.cloneMonth(created);
      }
      const existing = this.monthsById.get(where.id);
      if (existing) {
        Object.assign(existing, {
          ...existing,
          ...Object.entries(update).reduce<Record<string, number>>((acc, [key, value]) => {
            acc[key] = toNumber(value);
            return acc;
          }, {}),
        });
        return this.cloneMonth(existing);
      }
      throw new Error('budgetMonth.upsert: record not found');
    },

    findUnique: async ({
      where,
    }: {
  where: { userId_month?: { userId: string; month: Date }; id?: string };
    }) => {
      if (where.userId_month) {
        const result = this.findMonthByUserAndDate(where.userId_month.userId, where.userId_month.month);
        return result ? this.cloneMonth(result) : null;
      }
      if (where.id) {
        const result = this.monthsById.get(where.id);
        return result ? this.cloneMonth(result) : null;
      }
      return null;
    },

    findFirst: async ({
      where,
      orderBy,
    }: {
      where?: { userId?: string; month?: { lt?: Date } };
      orderBy?: { month?: 'asc' | 'desc' };
    }) => {
      let items = Array.from(this.monthsById.values());

      if (where?.userId) {
        items = items.filter((month) => month.userId === where.userId);
      }
      if (where?.month?.lt) {
        items = items.filter((month) => month.month.getTime() < where.month!.lt!.getTime());
      }

      if (orderBy?.month) {
        const direction = orderBy.month === 'asc' ? 1 : -1;
        items.sort((a, b) => (a.month.getTime() - b.month.getTime()) * direction);
      }

      const result = items[0];
      return result ? this.cloneMonth(result) : null;
    },

    findMany: async ({
      where,
      orderBy,
    }: {
      where?: { userId?: string };
      orderBy?: { month?: 'asc' | 'desc' };
    } = {}) => {
      let items = Array.from(this.monthsById.values());

      if (where?.userId) {
        items = items.filter((month) => month.userId === where.userId);
      }

      if (orderBy?.month) {
        const direction = orderBy.month === 'asc' ? 1 : -1;
        items.sort((a, b) => (a.month.getTime() - b.month.getTime()) * direction);
      }

      return items.map((item) => this.cloneMonth(item));
    },

    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: {
        income: DecimalValue;
        availableCarryover: DecimalValue;
        assigned: DecimalValue;
        available: DecimalValue;
        activity: DecimalValue;
      };
    }) => {
      const existing = this.monthsById.get(where.id);
      if (!existing) {
        throw new Error('budgetMonth.update: record not found');
      }
      existing.income = toNumber(data.income);
      existing.availableCarryover = toNumber(data.availableCarryover);
      existing.assigned = toNumber(data.assigned);
      existing.available = toNumber(data.available);
      existing.activity = toNumber(data.activity);
      existing.updatedAt = new Date();
      return this.cloneMonth(existing);
    },
  };

  budgetCategory = {
    upsert: async ({
      where,
      create,
    }: {
      where: { groupId_categoryId: { groupId: string; categoryId: string } };
      update: Record<string, never>;
      create: {
        groupId: string;
        categoryId: string;
        assigned: DecimalValue;
        activity: DecimalValue;
        available: DecimalValue;
      };
    }) => {
      const key = `${where.groupId_categoryId.groupId}|${where.groupId_categoryId.categoryId}`;
      const existing = this.budgetCategoryIndex.get(key);
      if (existing) {
        return { ...existing };
      }
      const id = `mock-budget-${Math.random().toString(36).slice(2, 11)}`;
      const record: MockBudgetCategory = {
        id,
        groupId: create.groupId,
        categoryId: create.categoryId,
        assigned: toNumber(create.assigned),
        activity: toNumber(create.activity),
        available: toNumber(create.available),
      };
      this.budgetCategoriesTable.push(record);
      this.budgetCategoryIndex.set(key, record);
      return { ...record };
    },

    aggregate: async ({
      where,
    }: {
      where: { group: { monthId: string } };
    }) => {
      const monthId = where.group.monthId;
      const sum = this.budgetCategoriesTable
        .filter((category) => this.groupsById.get(category.groupId)?.monthId === monthId)
        .reduce((acc, category) => acc + category.assigned, 0);
      return { _sum: { assigned: new Prisma.Decimal(sum) } };
    },

    findMany: async ({
      where,
      select,
      include,
    }: {
      where: { group: { monthId: string } };
      select?: { assigned?: boolean; activity?: boolean };
      include?: { category?: boolean };
    }) => {
      const monthId = where.group.monthId;
      const items = this.budgetCategoriesTable.filter(
        (category) => this.groupsById.get(category.groupId)?.monthId === monthId,
      );
      return items.map((item) => {
        const base: any = {
          id: item.id,
          groupId: item.groupId,
          categoryId: item.categoryId,
        };
        if (include?.category) {
          const category = this.categories.get(item.categoryId);
          base.category = category
            ? {
                ...category,
                sortOrder: category.sortOrder ?? 0,
              }
            : undefined;
        }
        if (!select || select.assigned) {
          base.assigned = new Prisma.Decimal(item.assigned);
        }
        if (!select || select.activity) {
          base.activity = new Prisma.Decimal(item.activity);
        }
        base.available = new Prisma.Decimal(item.available);
        if (include?.category) {
          base.category = {
            id: item.categoryId,
            name: '',
            sortOrder: 0,
          };
        }
        return base;
      });
    },

    update: async ({
      where,
      data,
      include,
    }: {
      where: { id: string };
      data: { activity?: DecimalValue; available?: DecimalValue };
      include?: { category?: boolean };
    }) => {
      const category = this.budgetCategoriesTable.find((item) => item.id === where.id);
      if (!category) {
        throw new Error('budgetCategory.update: record not found');
      }
      if (data.activity !== undefined) {
        category.activity = toNumber(data.activity);
      }
      if (data.available !== undefined) {
        category.available = toNumber(data.available);
      }
      const key = `${category.groupId}|${category.categoryId}`;
      this.budgetCategoryIndex.set(key, category);
      const base: any = {
        id: category.id,
        groupId: category.groupId,
        categoryId: category.categoryId,
        assigned: new Prisma.Decimal(category.assigned),
        activity: new Prisma.Decimal(category.activity),
        available: new Prisma.Decimal(category.available),
      };
      if (include?.category) {
        const fullCategory = this.categories.get(category.categoryId);
        base.category = fullCategory
          ? {
              ...fullCategory,
              sortOrder: fullCategory.sortOrder ?? 0,
            }
          : undefined;
      }
      return base;
    },
  };

  budgetCategoryGroup = {
    upsert: async ({
      where,
      create,
    }: {
      where: { monthId_categoryId: { monthId: string; categoryId: string } };
      update: Record<string, never>;
      create: { monthId: string; categoryId: string };
    }) => {
      const key = `${where.monthId_categoryId.monthId}|${where.monthId_categoryId.categoryId}`;
      const existing = this.groupByComposite.get(key);
      if (existing) {
        return { ...existing };
      }
      const id = `mock-group-${Math.random().toString(36).slice(2, 11)}`;
      const record: MockBudgetCategoryGroup = {
        id,
        monthId: create.monthId,
        categoryId: create.categoryId,
      };
      this.groupsById.set(id, record);
      this.groupByComposite.set(key, record);
      return { ...record };
    },
  };

  category = {
    findMany: async ({
      where,
      select,
    }: {
      where?: {
        id?: { in?: string[] };
        userId?: string;
        kind?: CategoryKind;
        parentCategoryId?: string | null;
      };
      select?: { id?: boolean };
    } = {}) => {
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
        const set = new Set(where.id.in);
        items = items.filter((item) => set.has(item.id));
      }
      return items.map((item) => {
        if (!select) {
          return { ...item };
        }
        const result: any = {};
        if (select.id) {
          result.id = item.id;
        }
        return result;
      });
    },

    findUnique: async ({
      where,
      select,
    }: {
      where: { id: string };
      select?: { parentCategoryId?: boolean };
    }) => {
      const item = this.categories.get(where.id);
      if (!item) {
        return null;
      }
      if (!select) {
        return { ...item };
      }
      const result: any = {};
      if (select.parentCategoryId) {
        result.parentCategoryId = item.parentCategoryId;
      }
      return result;
    },
  };

  transaction = {
    aggregate: async ({
      where,
    }: {
      where: {
        account?: { userId: string };
        date?: { gte?: Date; lt?: Date };
        category?: { kind?: CategoryKind | { in: CategoryKind[] } };
        transactionType?: TransactionType;
        categoryId?: string;
      };
    }) => {
      const sum = this.transactions
        .filter((transaction) => matchesTransactionWhere(transaction, where))
        .reduce((acc, transaction) => acc + transaction.amount, 0);
      return { _sum: { amount: new Prisma.Decimal(sum) } };
    },

    findMany: async ({
      where,
      select,
    }: {
      where?: {
        account?: { userId: string };
        date?: { gte?: Date; lt?: Date };
        category?: { kind?: CategoryKind | { in: CategoryKind[] } };
        transactionType?: TransactionType;
        categoryId?: string;
      };
      select?: { categoryId?: boolean };
    } = {}) => {
      const items = this.transactions
        .filter((transaction) => matchesTransactionWhere(transaction, where ?? {}))
        .map((transaction) => {
          if (!select) {
            return { ...transaction };
          }
          const result: any = {};
          if (select.categoryId) {
            result.categoryId = transaction.categoryId;
          }
          return result;
        });
      return items;
    },
  };
}

function matchesTransactionWhere(
  transaction: MockTransaction,
  where: {
    account?: { userId: string };
    date?: { gte?: Date; lt?: Date };
    category?: { kind?: CategoryKind | { in: CategoryKind[] } };
    transactionType?: TransactionType;
    categoryId?: string;
  },
): boolean {
  if (!where) return true;
  if (where.account?.userId && transaction.accountUserId !== where.account.userId) {
    return false;
  }
  if (where.categoryId !== undefined) {
    if (transaction.categoryId !== where.categoryId) {
      return false;
    }
  }
  if (where.date?.gte && transaction.date < where.date.gte) {
    return false;
  }
  if (where.date?.lt && transaction.date >= where.date.lt) {
    return false;
  }
  if (where.category?.kind) {
    const kindFilter = where.category.kind;
    if (transaction.categoryKind == null) {
      return false;
    }
    if (typeof kindFilter === 'object' && 'in' in kindFilter) {
      if (!kindFilter.in.includes(transaction.categoryKind)) {
        return false;
      }
    } else if (transaction.categoryKind !== kindFilter) {
      return false;
    }
  }
  if (where.transactionType && transaction.transactionType !== where.transactionType) {
    return false;
  }
  return true;
}
