import { strict as assert } from 'assert';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TransactionsService } from '../src/modules/transactions/transactions.service';

type CategoryRecord = {
  id: string;
  userId: string;
};

type TransactionRecord = {
  id: string;
  accountId: string;
  accountUserId: string;
};

class MinimalPrisma {
  constructor(
    private readonly categories: CategoryRecord[] = [],
    private readonly transactions: TransactionRecord[] = [],
  ) {}

  category = {
    findFirst: async ({ where }: { where: { id?: string; userId?: string } }) => {
      const match = this.categories.find((cat) => {
        if (where.id && cat.id !== where.id) return false;
        if (where.userId && cat.userId !== where.userId) return false;
        return true;
      });
      return match ? { id: match.id } : null;
    },
  };

  transaction = {
    findFirst: async ({ where }: { where: { id: string; account: { userId: string } } }) => {
      const match = this.transactions.find(
        (item) => item.id === where.id && item.accountUserId === where.account.userId,
      );
      return match ? { id: match.id } : null;
    },
  };
}

class StubEventsService {
  public readonly emitted: Array<{ event: string; payload: unknown }> = [];

  emit(event: string, payload: unknown) {
    this.emitted.push({ event, payload });
  }
}

class StubUserContext {
  getUserId() {
    return 'user-123';
  }
}

function createService(options?: {
  categories?: CategoryRecord[];
  transactions?: TransactionRecord[];
}) {
  const prisma = new MinimalPrisma(options?.categories ?? [], options?.transactions ?? []);
  const events = new StubEventsService();
  const userContext = new StubUserContext();
  const service = new TransactionsService(prisma as any, events as any, userContext as any);
  return { service, events, prisma };
}

async function testEnsureCategoryOwnershipAllowsKnownCategory() {
  const { service } = createService({ categories: [{ id: 'cat-1', userId: 'user-123' }] });
  await (service as any).ensureCategoryOwnership('cat-1', 'user-123');

  await assert.rejects(
    () => (service as any).ensureCategoryOwnership('missing', 'user-123'),
    NotFoundException,
  );
}

async function testEnsureTransactionOwnershipAllowsOwnedTransaction() {
  const { service } = createService({
    transactions: [{ id: 'tx-1', accountId: 'acc-1', accountUserId: 'user-123' }],
  });
  await (service as any).ensureTransactionOwnership('tx-1', 'user-123');
}

async function testResolveTopLevelCategoryIdUsesCache() {
  const { service } = createService();
  let calls = 0;
  const client = {
    category: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        calls += 1;
        if (where.id === 'child') {
          return { parentCategoryId: 'parent' };
        }
        if (where.id === 'parent') {
          return { parentCategoryId: null };
        }
        return null;
      },
    },
  };
  const cache = new Map<string, string>();

  const first = await (service as any).resolveTopLevelCategoryId(client, 'child', cache);
  const second = await (service as any).resolveTopLevelCategoryId(client, 'child', cache);

  assert.equal(first, 'parent');
  assert.equal(second, 'parent');
  assert.equal(calls, 2); // child + parent resolve only once thanks to cache
}

async function testEmitBudgetCategoryUpdatesDeduplicates() {
  const { service, events } = createService();
  const payloads = [
    { month: '2025-01', category: { id: 'cat-1' } },
    { month: '2025-01', category: { id: 'cat-1' } },
    { month: '2025-02', category: { id: 'cat-2' } },
  ];

  (service as any).emitBudgetCategoryUpdates(payloads);

  assert.equal(events.emitted.length, 2);
  const emittedIds = events.emitted.map((entry) => (entry.payload as any).category.id);
  assert.ok(emittedIds.includes('cat-1'));
  assert.ok(emittedIds.includes('cat-2'));
}

async function testEmitBudgetMonthUpdatesDeduplicates() {
  const { service, events } = createService();
  (service as any).emitBudgetMonthUpdates(['2025-01', '2025-01', '2025-02']);

  assert.equal(events.emitted.length, 2);
  const months = events.emitted.map((entry) => (entry.payload as any).month).sort();
  assert.deepEqual(months, ['2025-01', '2025-02']);
}

async function testToBudgetCategoryEntityMapsCategory() {
  const { service } = createService();
  const now = new Date();
  const entity = (service as any).toBudgetCategoryEntity({
    id: 'budget-1',
    groupId: 'group-1',
    categoryId: 'cat-1',
    assigned: new Prisma.Decimal(10),
    activity: new Prisma.Decimal(-5),
    available: new Prisma.Decimal(5),
    createdAt: now,
    updatedAt: now,
    category: { id: 'cat-1', name: 'Courses', sortOrder: '7' },
  });

  assert.equal(entity.assigned, 10);
  assert.equal(entity.category?.sortOrder, 7);
}

async function testToBudgetCategoryEntityHandlesMissingCategory() {
  const { service } = createService();
  const entity = (service as any).toBudgetCategoryEntity({
    id: 'budget-2',
    groupId: 'group-1',
    categoryId: 'cat-2',
    assigned: 0,
    activity: 0,
    available: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  assert.equal(entity.category, undefined);
}

async function testToBudgetCategoryEntityDefaultsMissingValues() {
  const { service } = createService();
  const now = new Date();
  const entity = (service as any).toBudgetCategoryEntity({
    id: 'budget-3',
    groupId: 'group-1',
    categoryId: 'cat-3',
    createdAt: now,
    updatedAt: now,
    category: { id: 'cat-3', name: 'Courses' },
  });

  assert.equal(entity.assigned, 0);
  assert.equal(entity.activity, 0);
  assert.equal(entity.available, 0);
  assert.equal(entity.category?.sortOrder, 0);
}

async function testToEntityCategoryFallbacks() {
  const { service } = createService();
  const now = new Date();
  const base = {
    id: 'tx-1',
    accountId: 'acc-1',
    date: new Date(Date.UTC(2025, 0, 1)),
    label: 'Test',
    amount: new Prisma.Decimal(5),
    status: 'NONE',
    transactionType: 'NONE',
    linkedTransactionId: null,
    createdAt: now,
    updatedAt: now,
  };

  const withCategory = (service as any).toEntity(
    {
      ...base,
      categoryId: 'cat-1',
      category: { id: 'cat-1', name: 'Categorie' },
    },
    10,
  );
  assert.equal(withCategory.categoryId, 'cat-1');
  assert.equal(withCategory.categoryName, 'Categorie');

  const withoutCategory = (service as any).toEntity(
    {
      ...base,
      categoryId: null,
      category: null,
    },
    5,
  );
  assert.equal(withoutCategory.categoryId, null);
  assert.equal(withoutCategory.categoryName, null);
}

async function testEmitAccountUpdatedSkipsNull() {
  const { service, events } = createService();

  (service as any).emitAccountUpdated(null);

  assert.equal(events.emitted.length, 0);
}

async function testEmitAccountUpdatedEmitsEntity() {
  const { service, events } = createService();
  const now = new Date();
  const account = {
    id: 'acc-1',
    userId: 'user-123',
    name: 'Compte courant',
    type: 'CHECKING',
    currency: 'EUR',
    archived: false,
    initialBalance: new Prisma.Decimal(10),
    currentBalance: new Prisma.Decimal(25),
    pointedBalance: new Prisma.Decimal(20),
    reconciledBalance: new Prisma.Decimal(15),
    createdAt: now,
    updatedAt: now,
  };

  (service as any).emitAccountUpdated(account);

  assert.equal(events.emitted.length, 1);
  assert.equal(events.emitted[0].event, 'account.updated');
  assert.equal((events.emitted[0].payload as any).currentBalance, 25);
}

async function testRecalculateBudgetMonthSummaryFallsBackToLastMonth() {
  const { service } = createService();
  const baseMonth = new Date(Date.UTC(2025, 0, 15));
  const monthRecord = {
    id: 'month-1',
    userId: 'user-123',
    month: new Date(Date.UTC(2024, 11, 1)),
    availableCarryover: new Prisma.Decimal(0),
    income: new Prisma.Decimal(0),
    assigned: new Prisma.Decimal(0),
    available: new Prisma.Decimal(0),
    activity: new Prisma.Decimal(0),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const client = {
    budgetMonth: {
      upsert: async () => monthRecord,
      findMany: async () => [monthRecord],
      update: async () => monthRecord,
    },
    transaction: {
      aggregate: async () => ({ _sum: { amount: new Prisma.Decimal(0) } }),
      findMany: async () => [],
    },
    budgetCategory: {
      aggregate: async () => ({ _sum: { assigned: new Prisma.Decimal(0) } }),
      findMany: async () => [],
    },
  };

  const summary = await (service as any).recalculateBudgetMonthSummary(
    client,
    'user-123',
    baseMonth,
  );

  assert.equal(summary.month.id, 'month-1');
  assert.equal(summary.months.length, 1);
}

(async () => {
  await testEnsureCategoryOwnershipAllowsKnownCategory();
  await testEnsureTransactionOwnershipAllowsOwnedTransaction();
  await testResolveTopLevelCategoryIdUsesCache();
  await testEmitBudgetCategoryUpdatesDeduplicates();
  await testEmitBudgetMonthUpdatesDeduplicates();
  await testToBudgetCategoryEntityMapsCategory();
  await testToBudgetCategoryEntityHandlesMissingCategory();
  await testToBudgetCategoryEntityDefaultsMissingValues();
  await testToEntityCategoryFallbacks();
  await testEmitAccountUpdatedSkipsNull();
  await testEmitAccountUpdatedEmitsEntity();
  await testRecalculateBudgetMonthSummaryFallsBackToLastMonth();
  console.log('Transactions internals tests passed ✓');
})();
