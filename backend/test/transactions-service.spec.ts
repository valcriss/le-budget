import { strict as assert } from 'assert';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { TransactionsService } from '../src/modules/transactions/transactions.service';

type AccountRecord = {
  id: string;
  userId: string;
  initialBalance: Prisma.Decimal | number;
  currentBalance: Prisma.Decimal | number;
  pointedBalance: Prisma.Decimal | number;
  reconciledBalance: Prisma.Decimal | number;
};

type TransactionRecord = {
  id: string;
  accountId: string;
  accountUserId: string;
  categoryId: string | null;
  date: Date;
  label: string;
  amount: number;
  status: TransactionStatus;
  transactionType: TransactionType;
  createdAt: Date;
  updatedAt: Date;
  linkedTransactionId?: string | null;
};

type CategoryRecord = {
  id: string;
  userId: string;
  name: string;
};

let transactionCounter = 100;

class TransactionsPrismaStub {
  constructor(
    private readonly accounts: AccountRecord[],
    private readonly transactions: TransactionRecord[],
    private readonly categories: CategoryRecord[],
  ) {}

  private getAccountUserId(accountId: string): string {
    const account = this.accounts.find((item) => item.id === accountId);
    return account ? (account.userId as string) : 'user-unknown';
  }

  account = {
    findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
      const match = this.accounts.find((account) => account.id === where.id && account.userId === where.userId);
      return match ? { ...match } : null;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<AccountRecord> }) => {
      const index = this.accounts.findIndex((account) => account.id === where.id);
      if (index === -1) {
        throw new Error('Account not found');
      }
      this.accounts[index] = { ...this.accounts[index], ...data };
      return { ...this.accounts[index] };
    },
  };

  transaction = {
    findMany: async ({
      where,
      include,
      orderBy,
      skip,
      take,
      select,
    }: {
      where?: any;
      include?: { category?: { select: { id: boolean; name: boolean } } };
      orderBy?: Array<any>;
      skip?: number;
      take?: number;
      select?: { id?: boolean; amount?: boolean; date?: boolean; createdAt?: boolean; transactionType?: boolean };
    } = {}) => {
      let items = [...this.transactions];

      if (where?.accountId) {
        items = items.filter((item) => item.accountId === where.accountId);
      }

      if (where?.account?.userId) {
        items = items.filter((item) => item.accountUserId === where.account.userId);
      }

      if (where?.date?.gte) {
        const after = new Date(where.date.gte).getTime();
        items = items.filter((item) => item.date.getTime() >= after);
      }

      if (where?.date?.lte) {
        const before = new Date(where.date.lte).getTime();
        items = items.filter((item) => item.date.getTime() <= before);
      }

      if (where?.date?.lt) {
        const beforeExclusive = new Date(where.date.lt).getTime();
        items = items.filter((item) => item.date.getTime() < beforeExclusive);
      }

      if (where?.label?.contains) {
        const needle = String(where.label.contains).toLowerCase();
        items = items.filter((item) => item.label.toLowerCase().includes(needle));
      }

      if (where?.status) {
        if (Array.isArray(where.status.in)) {
          const allowed = new Set(where.status.in);
          items = items.filter((item) => allowed.has(item.status));
        } else {
          items = items.filter((item) => item.status === where.status);
        }
      }

      if (where?.transactionType) {
        items = items.filter((item) => item.transactionType === where.transactionType);
      }

      if (orderBy) {
        for (const rule of orderBy.reverse()) {
          if (rule.date) {
            items.sort((a, b) =>
              rule.date === 'asc' ? a.date.getTime() - b.date.getTime() : b.date.getTime() - a.date.getTime(),
            );
          } else if (rule.label) {
            items.sort((a, b) =>
              rule.label === 'asc' ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label),
            );
          } else if (rule.amount) {
            items.sort((a, b) => (rule.amount === 'asc' ? a.amount - b.amount : b.amount - a.amount));
          } else if (rule.createdAt) {
            items.sort((a, b) =>
              rule.createdAt === 'asc'
                ? a.createdAt.getTime() - b.createdAt.getTime()
                : b.createdAt.getTime() - a.createdAt.getTime(),
            );
          } else if (rule.category?.name) {
            items.sort((a, b) => {
              const categoryA = this.categories.find((cat) => cat.id === a.categoryId)?.name ?? '';
              const categoryB = this.categories.find((cat) => cat.id === b.categoryId)?.name ?? '';
              return rule.category.name === 'asc'
                ? categoryA.localeCompare(categoryB)
                : categoryB.localeCompare(categoryA);
            });
          }
        }
      }

      if (skip) {
        items = items.slice(skip);
      }
      if (take !== undefined) {
        items = items.slice(0, take);
      }

      return items.map((item) => {
        if (select) {
          const result: any = {};
          if (select.id) result.id = item.id;
          if (select.amount) result.amount = new Prisma.Decimal(item.amount);
          if (select.date) result.date = item.date;
          if (select.createdAt) result.createdAt = item.createdAt;
          if (select.transactionType) result.transactionType = item.transactionType;
          return result;
        }

        const base: any = { ...item, amount: new Prisma.Decimal(item.amount) };
        if (include?.category) {
          const category = this.categories.find((cat) => cat.id === item.categoryId);
          base.category = category ? { id: category.id, name: category.name } : null;
        }
        return base;
      });
    },

    findUnique: async ({ where, include }: { where: { id: string }; include?: { category?: { select: { id: boolean; name: boolean } } } }) => {
      const match = this.transactions.find((item) => item.id === where.id);
      if (!match) {
        return null;
      }
      const base: any = { ...match, amount: new Prisma.Decimal(match.amount) };
      if (include?.category) {
        const category = match.categoryId
          ? this.categories.find((cat) => cat.id === match.categoryId)
          : null;
        base.category = category ? { id: category.id, name: category.name } : null;
      }
      return base;
    },

    findFirst: async ({ where }: { where: { id: string; account?: { userId: string } } }) => {
      const match = this.transactions.find((item) => {
        if (item.id !== where.id) {
          return false;
        }
        if (where.account?.userId) {
          return item.accountUserId === where.account.userId;
        }
        return true;
      });
      return match ? { ...match, amount: new Prisma.Decimal(match.amount) } : null;
    },

    count: async ({ where }: { where?: any }) => {
      return (await this.transaction.findMany({ where })).length;
    },

    create: async ({ data, include }: { data: any; include?: { category?: { select: { id: boolean; name: boolean } } } }) => {
      const record: TransactionRecord = {
        id: `tx-${transactionCounter++}`,
        accountId: data.accountId,
        accountUserId: this.getAccountUserId(data.accountId),
        categoryId: data.categoryId ?? null,
        date: new Date(data.date),
        label: data.label,
        amount: Number(data.amount),
        status: data.status,
        transactionType: data.transactionType,
        linkedTransactionId: data.linkedTransactionId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.transactions.push(record);
      const base: any = { ...record, amount: new Prisma.Decimal(record.amount) };
      if (include?.category) {
        const category = this.categories.find((cat) => cat.id === record.categoryId);
        base.category = category ? { id: category.id, name: category.name } : null;
      }
      return base;
    },

    update: async ({
      where,
      data,
      include,
    }: {
      where: { id: string };
      data: {
        categoryId?: string | null;
        date?: Date;
        label?: string;
        amount?: Prisma.Decimal;
        status?: TransactionStatus;
        transactionType?: TransactionType;
        linkedTransactionId?: string | null;
      };
      include?: { category?: { select: { id: boolean; name: boolean } } };
    }) => {
      const record = this.transactions.find((item) => item.id === where.id);
      if (!record) {
        throw new Error('Transaction not found');
      }
      if (data.categoryId !== undefined) record.categoryId = data.categoryId;
      if (data.date !== undefined) record.date = new Date(data.date);
      if (data.label !== undefined) record.label = data.label;
      if (data.amount !== undefined) record.amount = Number(data.amount);
      if (data.status !== undefined) record.status = data.status;
      if (data.transactionType !== undefined) record.transactionType = data.transactionType;
      if (data.linkedTransactionId !== undefined) record.linkedTransactionId = data.linkedTransactionId;
      record.updatedAt = new Date();
      const base: any = { ...record, amount: new Prisma.Decimal(record.amount) };
      if (include?.category) {
        const category = record.categoryId
          ? this.categories.find((cat) => cat.id === record.categoryId)
          : null;
        base.category = category ? { id: category.id, name: category.name } : null;
      }
      return base;
    },

    delete: async ({ where }: { where: { id: string } }) => {
      const index = this.transactions.findIndex((item) => item.id === where.id);
      if (index === -1) {
        throw new Error('Transaction not found');
      }
      const [removed] = this.transactions.splice(index, 1);
      return { ...removed, amount: new Prisma.Decimal(removed.amount) };
    },

    aggregate: async ({
      where,
    }: {
      where: {
        accountId?: string;
        account?: { userId: string };
        date?: { gte?: Date; lt?: Date };
        category?: { kind?: CategoryKind | { in: CategoryKind[] } };
        transactionType?: TransactionType;
        status?: { in?: TransactionStatus[] };
        categoryId?: string;
      };
    }) => {
      const filtered = this.transactions.filter((item) => matchesAggregateWhere(item, where));
      const sum = filtered.reduce((acc, item) => acc + item.amount, 0);
      return { _sum: { amount: new Prisma.Decimal(sum) } };
    },
  };

  category = {
    findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
      const category = this.categories.find((cat) => cat.id === where.id && cat.userId === where.userId);
      return category ? { id: category.id } : null;
    },
  };

  $transaction = async (arg: any) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    const txClient = {
      transaction: this.transaction,
      account: this.account,
    };
    return arg(txClient);
  };
}

function matchesAggregateWhere(
  transaction: TransactionRecord,
  where: {
    accountId?: string;
    account?: { userId: string };
    date?: { gte?: Date; lt?: Date };
    category?: { kind?: CategoryKind | { in: CategoryKind[] } };
    transactionType?: TransactionType;
    status?: { in?: TransactionStatus[] };
    categoryId?: string;
  },
): boolean {
  if (!where) return true;
  if (where.accountId && transaction.accountId !== where.accountId) return false;
  if (where.account?.userId && transaction.accountUserId !== where.account.userId) return false;
  if (where.date?.gte && transaction.date < where.date.gte) return false;
  if (where.date?.lt && transaction.date >= where.date.lt) return false;
  if (where.categoryId && transaction.categoryId !== where.categoryId) return false;
  if (where.transactionType && transaction.transactionType !== where.transactionType) return false;
  if (where.status?.in && !where.status.in.includes(transaction.status)) return false;
  return true;
}

class StubEventsService {
  public readonly emitted: Array<{ event: string; payload: unknown }> = [];

  emit(event: string, payload: unknown) {
    this.emitted.push({ event, payload });
  }
}

class StubUserContext {
  constructor(private readonly userId: string) {}

  getUserId() {
    return this.userId;
  }
}

function createTransactionsService(prisma: TransactionsPrismaStub) {
  const events = new StubEventsService();
  const service = new TransactionsService(prisma as any, events as any, new StubUserContext('user-123') as any);
  return { service, events, prisma };
}

async function testFindManyReturnsFormattedResults() {
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(100),
        currentBalance: new Prisma.Decimal(100),
        pointedBalance: new Prisma.Decimal(100),
        reconciledBalance: new Prisma.Decimal(100),
      },
    ],
    [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        accountUserId: 'user-123',
        categoryId: 'cat-income',
        date: new Date(Date.UTC(2025, 0, 1)),
        label: 'Salaire',
        amount: 500,
        status: TransactionStatus.NONE,
        transactionType: TransactionType.NONE,
        createdAt: new Date(Date.UTC(2025, 0, 1, 12)),
        updatedAt: new Date(),
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        accountUserId: 'user-123',
        categoryId: 'cat-rent',
        date: new Date(Date.UTC(2025, 0, 5)),
        label: 'Loyer Janvier',
        amount: -300,
        status: TransactionStatus.NONE,
        transactionType: TransactionType.NONE,
        createdAt: new Date(Date.UTC(2025, 0, 5, 8)),
        updatedAt: new Date(),
      },
      {
        id: 'tx-3',
        accountId: 'acc-1',
        accountUserId: 'user-123',
        categoryId: 'cat-groceries',
        date: new Date(Date.UTC(2025, 0, 10)),
        label: 'Courses',
        amount: -50,
        status: TransactionStatus.NONE,
        transactionType: TransactionType.NONE,
        createdAt: new Date(Date.UTC(2025, 0, 10, 18)),
        updatedAt: new Date(),
      },
      {
        id: 'tx-0',
        accountId: 'acc-1',
        accountUserId: 'user-123',
        categoryId: 'cat-initial',
        date: new Date(Date.UTC(2024, 11, 31)),
        label: 'Solde initial',
        amount: 100,
        status: TransactionStatus.RECONCILED,
        transactionType: TransactionType.INITIAL,
        createdAt: new Date(Date.UTC(2024, 11, 31, 23)),
        updatedAt: new Date(),
      },
    ],
    [
      { id: 'cat-income', userId: 'user-123', name: 'Salaire' },
      { id: 'cat-rent', userId: 'user-123', name: 'Loyer' },
      { id: 'cat-groceries', userId: 'user-123', name: 'Courses' },
      { id: 'cat-initial', userId: 'user-123', name: 'Solde initial' },
    ],
  );

  const { service } = createTransactionsService(prisma);
  const override = service as any;
  override.recalculateBudgetMonthForUser = async () => null;

  const result = await service.findMany('acc-1', {
    from: '2025-01-01',
    to: '2025-01-31',
    search: 'Loyer',
    status: TransactionStatus.NONE,
    transactionType: TransactionType.NONE,
    take: 2,
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.meta.total, 1);
  assert.equal(result.items[0].label.includes('Loyer'), true);
  assert.equal(result.items[0].balance, 300);
}

async function testFindManyThrowsWhenAccountMissing() {
  const prisma = new TransactionsPrismaStub([], [], []);
  const { service } = createTransactionsService(prisma);

  await assert.rejects(() => service.findMany('unknown', {} as any), NotFoundException);
}

async function testCreateValidTransaction() {
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(150),
        currentBalance: new Prisma.Decimal(150),
        pointedBalance: new Prisma.Decimal(150),
        reconciledBalance: new Prisma.Decimal(150),
      },
    ],
    [],
    [
      { id: 'cat-income', userId: 'user-123', name: 'Salaire' },
    ],
  );
  const { service, events } = createTransactionsService(prisma);

  const override = service as any;
  override.recalculateAccountBalances = async () => ({
    id: 'acc-1',
    userId: 'user-123',
    name: 'Compte courant',
    initialBalance: new Prisma.Decimal(150),
    currentBalance: new Prisma.Decimal(200),
    pointedBalance: new Prisma.Decimal(200),
    reconciledBalance: new Prisma.Decimal(150),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  override.recalculateRunningMap = async () => new Map<string, number>([['tx-100', 350]]);
  override.recalculateBudgetMonthForUser = async () => null;
  override.emitAccountUpdated = () => undefined;

  const entity = await service.create('acc-1', {
    categoryId: 'cat-income',
    amount: 200,
    date: '2025-02-01',
    label: 'Prime',
    status: TransactionStatus.NONE,
    transactionType: TransactionType.NONE,
  } as any);

  assert.equal(entity.amount, 200);
  assert.equal(entity.balance, 350);
  assert.equal(events.emitted.some((event) => event.event === 'transaction.created'), true);
}

async function testCreateRejectsInitialType() {
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    [],
    [],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(
    () =>
      service.create('acc-1', {
        amount: 0,
        date: '2025-01-01',
        label: 'Initial',
        transactionType: TransactionType.INITIAL,
      } as any),
    BadRequestException,
  );
}

async function testCreateInitialTransaction() {
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    [],
    [{ id: 'cat-initial', userId: 'user-123', name: 'Solde initial' }],
  );
  const { service, events } = createTransactionsService(prisma);
  const override = service as any;
  override.recalculateAccountBalances = async () => ({
    id: 'acc-1',
    userId: 'user-123',
    name: 'Compte courant',
    initialBalance: new Prisma.Decimal(0),
    currentBalance: new Prisma.Decimal(250),
    pointedBalance: new Prisma.Decimal(250),
    reconciledBalance: new Prisma.Decimal(250),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  override.recalculateRunningMap = async () => {
    const map = new Map<string, number>();
    for (const tx of (prisma as any).transactions as TransactionRecord[]) {
      map.set(tx.id, 250);
    }
    return map;
  };
  override.recalculateBudgetMonthForUser = async () => null;
  override.emitAccountUpdated = () => undefined;

  const entity = await service.createInitialTransactionForAccount('acc-1', {
    amount: 250,
    categoryId: 'cat-initial',
  });

  assert.equal(entity.transactionType, TransactionType.INITIAL);
  assert.equal(entity.label, 'Solde initial');
  assert.equal(events.emitted.some((event) => event.event === 'transaction.created'), true);
}

async function testCreateInitialTransactionRejectsMissingCategory() {
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    [],
    [],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(
    () =>
      service.createInitialTransactionForAccount('acc-1', {
        amount: 0,
        categoryId: '',
      }),
    BadRequestException,
  );
}

async function testCreateInitialTransactionRejectsInvalidDate() {
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    [],
    [{ id: 'cat-initial', userId: 'user-123', name: 'Initial' }],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(
    () =>
      service.createInitialTransactionForAccount('acc-1', {
        amount: 0,
        categoryId: 'cat-initial',
        date: new Date('not-a-date'),
      }),
    BadRequestException,
  );
}

async function testFindOneReturnsTransaction() {
  const existing: TransactionRecord = {
    id: 'tx-existing',
    accountId: 'acc-1',
    accountUserId: 'user-123',
    categoryId: 'cat-income',
    date: new Date(Date.UTC(2025, 2, 1)),
    label: 'Salaire Mars',
    amount: 900,
    status: TransactionStatus.NONE,
    transactionType: TransactionType.NONE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    [existing],
    [{ id: 'cat-income', userId: 'user-123', name: 'Salaire' }],
  );
  const { service } = createTransactionsService(prisma);
  const override = service as any;
  override.recalculateRunningMap = async () => new Map<string, number>([['tx-existing', 900]]);
  override.recalculateBudgetMonthForUser = async () => null;

  const entity = await service.findOne('acc-1', 'tx-existing');
  assert.equal(entity.label, 'Salaire Mars');
  assert.equal(entity.balance, 900);
}

async function testFindOneThrowsWhenTransactionMissing() {
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    [],
    [],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(() => service.findOne('acc-1', 'unknown'), NotFoundException);
}

async function testUpdateThrowsForUnknownCategory() {
  const transactionsData: TransactionRecord[] = [
    {
      id: 'tx-1',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-existing',
      date: new Date(Date.UTC(2025, 0, 5)),
      label: 'Courses',
      amount: -40,
      status: TransactionStatus.NONE,
      transactionType: TransactionType.NONE,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    transactionsData,
    [{ id: 'cat-existing', userId: 'user-123', name: 'Courses' }],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(
    () =>
      service.update('acc-1', 'tx-1', {
        categoryId: 'cat-missing',
      } as any),
    NotFoundException,
  );
}

async function testUpdateThrowsForForeignLinkedTransaction() {
  const transactionsData: TransactionRecord[] = [
    {
      id: 'tx-1',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-existing',
      date: new Date(Date.UTC(2025, 0, 5)),
      label: 'Courses',
      amount: -40,
      status: TransactionStatus.NONE,
      transactionType: TransactionType.NONE,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'tx-foreign',
      accountId: 'acc-2',
      accountUserId: 'user-999',
      categoryId: null,
      date: new Date(),
      label: 'Foreign',
      amount: 10,
      status: TransactionStatus.NONE,
      transactionType: TransactionType.NONE,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
      {
        id: 'acc-2',
        userId: 'user-999',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    transactionsData,
    [{ id: 'cat-existing', userId: 'user-123', name: 'Courses' }],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(
    () =>
      service.update('acc-1', 'tx-1', {
        linkedTransactionId: 'tx-foreign',
      } as any),
    NotFoundException,
  );
}

async function testFindOneIncludesLinkedTransaction() {
  const transactionsData: TransactionRecord[] = [
    {
      id: 'tx-0',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-initial',
      date: new Date(Date.UTC(2025, 0, 1)),
      label: 'Solde initial',
      amount: 100,
      status: TransactionStatus.RECONCILED,
      transactionType: TransactionType.INITIAL,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'tx-2',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-income',
      date: new Date(Date.UTC(2025, 0, 10)),
      label: 'Remboursement',
      amount: 50,
      status: TransactionStatus.NONE,
      transactionType: TransactionType.NONE,
      linkedTransactionId: 'tx-0',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(100),
        currentBalance: new Prisma.Decimal(150),
        pointedBalance: new Prisma.Decimal(100),
        reconciledBalance: new Prisma.Decimal(100),
      },
    ],
    transactionsData,
    [
      { id: 'cat-initial', userId: 'user-123', name: 'Initial' },
      { id: 'cat-income', userId: 'user-123', name: 'Remboursement' },
    ],
  );
  const { service } = createTransactionsService(prisma);
  const override = service as any;
  override.recalculateRunningMap = async () => new Map<string, number>([
    ['tx-0', 100],
    ['tx-2', 150],
  ]);
  override.recalculateBudgetMonthForUser = async () => null;

  const entity = await service.findOne('acc-1', 'tx-2');
  assert.equal(entity.linkedTransactionId, 'tx-0');
  assert.equal(entity.credit, 50);
  assert.equal(entity.categoryName, 'Remboursement');
}

async function testRemoveThrowsWhenAccountMissing() {
  const prisma = new TransactionsPrismaStub([], [], []);
  const { service } = createTransactionsService(prisma);

  await assert.rejects(() => service.remove('acc-missing', 'tx-1'), NotFoundException);
}

async function testRemoveThrowsWhenTransactionMissing() {
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    [],
    [],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(() => service.remove('acc-1', 'missing'), NotFoundException);
}

async function testUpdateTransactionAdjustsBalances() {
  const transactionsData: TransactionRecord[] = [
    {
      id: 'tx-0',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-initial',
      date: new Date(Date.UTC(2025, 0, 1)),
      label: 'Solde initial',
      amount: 100,
      status: TransactionStatus.RECONCILED,
      transactionType: TransactionType.INITIAL,
      createdAt: new Date(Date.UTC(2025, 0, 1, 8)),
      updatedAt: new Date(Date.UTC(2025, 0, 1, 8)),
    },
    {
      id: 'tx-1',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-grocery',
      date: new Date(Date.UTC(2025, 0, 5)),
      label: 'Courses',
      amount: -40,
      status: TransactionStatus.NONE,
      transactionType: TransactionType.NONE,
      createdAt: new Date(Date.UTC(2025, 0, 5, 10)),
      updatedAt: new Date(Date.UTC(2025, 0, 5, 10)),
    },
  ];
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(100),
        currentBalance: new Prisma.Decimal(60),
        pointedBalance: new Prisma.Decimal(100),
        reconciledBalance: new Prisma.Decimal(100),
      },
    ],
    transactionsData,
    [
      { id: 'cat-grocery', userId: 'user-123', name: 'Courses' },
      { id: 'cat-initial', userId: 'user-123', name: 'Initial' },
    ],
  );
  const { service, events } = createTransactionsService(prisma);
  const override = service as any;
  override.recalculateBudgetMonthForUser = async () => null;
  override.emitAccountUpdated = () => undefined;

  const updated = await service.update('acc-1', 'tx-1', {
    amount: -60,
    categoryId: 'cat-grocery',
    label: 'Courses modifiées',
  } as any);

  assert.equal(updated.label, 'Courses modifiées');
  assert.equal(updated.amount, -60);
  assert.equal(events.emitted.some((event) => event.event === 'transaction.updated'), true);
  const stored = prisma['accounts'][0];
  assert.equal(Number(stored.currentBalance), 40);
}

async function testUpdateInitialTransactionRejectsLabelChange() {
  const transactionsData: TransactionRecord[] = [
    {
      id: 'tx-0',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-initial',
      date: new Date(Date.UTC(2025, 0, 1)),
      label: 'Solde initial',
      amount: 100,
      status: TransactionStatus.RECONCILED,
      transactionType: TransactionType.INITIAL,
      createdAt: new Date(Date.UTC(2025, 0, 1, 8)),
      updatedAt: new Date(Date.UTC(2025, 0, 1, 8)),
    },
  ];
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(100),
        currentBalance: new Prisma.Decimal(100),
        pointedBalance: new Prisma.Decimal(100),
        reconciledBalance: new Prisma.Decimal(100),
      },
    ],
    transactionsData,
    [{ id: 'cat-initial', userId: 'user-123', name: 'Initial' }],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(
    () =>
      service.update('acc-1', 'tx-0', {
        label: 'Nouveau libellé',
      } as any),
    BadRequestException,
  );
}

async function testRemoveTransactionDeletesRecord() {
  const transactionsData: TransactionRecord[] = [
    {
      id: 'tx-0',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-initial',
      date: new Date(Date.UTC(2025, 0, 1)),
      label: 'Solde initial',
      amount: 100,
      status: TransactionStatus.RECONCILED,
      transactionType: TransactionType.INITIAL,
      createdAt: new Date(Date.UTC(2025, 0, 1, 8)),
      updatedAt: new Date(Date.UTC(2025, 0, 1, 8)),
    },
    {
      id: 'tx-1',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-grocery',
      date: new Date(Date.UTC(2025, 0, 5)),
      label: 'Courses',
      amount: -40,
      status: TransactionStatus.NONE,
      transactionType: TransactionType.NONE,
      createdAt: new Date(Date.UTC(2025, 0, 5, 10)),
      updatedAt: new Date(Date.UTC(2025, 0, 5, 10)),
    },
  ];
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(100),
        currentBalance: new Prisma.Decimal(60),
        pointedBalance: new Prisma.Decimal(100),
        reconciledBalance: new Prisma.Decimal(100),
      },
    ],
    transactionsData,
    [
      { id: 'cat-grocery', userId: 'user-123', name: 'Courses' },
      { id: 'cat-initial', userId: 'user-123', name: 'Initial' },
    ],
  );
  const { service, events } = createTransactionsService(prisma);
  const override = service as any;
  override.recalculateBudgetMonthForUser = async () => null;
  override.emitAccountUpdated = () => undefined;

  const entity = await service.remove('acc-1', 'tx-1');
  assert.equal(entity.id, 'tx-1');
  assert.equal(events.emitted.some((event) => event.event === 'transaction.deleted'), true);
  assert.equal(prisma['transactions'].length, 1);
}

async function testRemoveRejectsInitialTransaction() {
  const transactionsData: TransactionRecord[] = [
    {
      id: 'tx-0',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-initial',
      date: new Date(Date.UTC(2025, 0, 1)),
      label: 'Solde initial',
      amount: 100,
      status: TransactionStatus.RECONCILED,
      transactionType: TransactionType.INITIAL,
      createdAt: new Date(Date.UTC(2025, 0, 1, 8)),
      updatedAt: new Date(Date.UTC(2025, 0, 1, 8)),
    },
  ];
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(100),
        currentBalance: new Prisma.Decimal(100),
        pointedBalance: new Prisma.Decimal(100),
        reconciledBalance: new Prisma.Decimal(100),
      },
    ],
    transactionsData,
    [{ id: 'cat-initial', userId: 'user-123', name: 'Initial' }],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(() => service.remove('acc-1', 'tx-0'), BadRequestException);
}


async function testCreateThrowsWhenAccountMissing() {
  const prisma = new TransactionsPrismaStub([], [], []);
  const { service } = createTransactionsService(prisma);

  await assert.rejects(
    () =>
      service.create('acc-missing', {
        amount: 10,
        date: '2025-01-01',
        label: 'Test',
      } as any),
    NotFoundException,
  );
}

async function testCreateRejectsUnknownCategory() {
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    [],
    [],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(
    () =>
      service.create('acc-1', {
        categoryId: 'cat-missing',
        amount: 10,
        date: '2025-01-01',
        label: 'Test',
      } as any),
    NotFoundException,
  );
}

async function testCreateRejectsUnknownLinkedTransaction() {
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    [],
    [{ id: 'cat-1', userId: 'user-123', name: 'Test' }],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(
    () =>
      service.create('acc-1', {
        categoryId: 'cat-1',
        amount: 10,
        date: '2025-01-01',
        label: 'Test',
        linkedTransactionId: 'tx-missing',
      } as any),
    NotFoundException,
  );
}

async function testCreateWithLinkedTransactionAcceptsOwned() {
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    [
      {
        id: 'tx-linked',
        accountId: 'acc-1',
        accountUserId: 'user-123',
        categoryId: null,
        date: new Date(),
        label: 'Linked',
        amount: 0,
        status: TransactionStatus.NONE,
        transactionType: TransactionType.NONE,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    [{ id: 'cat-1', userId: 'user-123', name: 'Test' }],
  );
  const { service, events } = createTransactionsService(prisma);
  const override = service as any;
  override.recalculateAccountBalances = async () => ({
    id: 'acc-1',
    userId: 'user-123',
    name: 'Compte',
    initialBalance: new Prisma.Decimal(0),
    currentBalance: new Prisma.Decimal(10),
    pointedBalance: new Prisma.Decimal(10),
    reconciledBalance: new Prisma.Decimal(10),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  override.recalculateRunningMap = async () => new Map<string, number>([['tx-100', 10]]);
  override.recalculateBudgetMonthForUser = async () => null;
  override.emitAccountUpdated = () => undefined;

  const entity = await service.create('acc-1', {
    categoryId: 'cat-1',
    amount: 10,
    date: '2025-01-01',
    label: 'Test',
    linkedTransactionId: 'tx-linked',
  } as any);

  assert.equal(entity.linkedTransactionId, 'tx-linked');
  assert.equal(events.emitted.some((event) => event.event === 'transaction.created'), true);
}

async function testCreateInitialTransactionThrowsWhenAccountMissing() {
  const prisma = new TransactionsPrismaStub([], [], []);
  const { service } = createTransactionsService(prisma);

  await assert.rejects(
    () =>
      service.createInitialTransactionForAccount('missing', {
        amount: 10,
        categoryId: 'cat-1',
      }),
    NotFoundException,
  );
}

async function testFindOneThrowsWhenAccountMissing() {
  const prisma = new TransactionsPrismaStub([], [], []);
  const { service } = createTransactionsService(prisma);

  await assert.rejects(() => service.findOne('missing', 'tx-1'), NotFoundException);
}

async function testUpdateThrowsWhenAccountMissing() {
  const prisma = new TransactionsPrismaStub([], [], []);
  const { service } = createTransactionsService(prisma);

  await assert.rejects(() => service.update('missing', 'tx-1', {} as any), NotFoundException);
}

async function testUpdateThrowsWhenTransactionMissing() {
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    [],
    [],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(() => service.update('acc-1', 'missing', {} as any), NotFoundException);
}

async function testUpdateRejectsChangingInitialCategory() {
  const transactionsData: TransactionRecord[] = [
    {
      id: 'tx-0',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-initial',
      date: new Date(Date.UTC(2025, 0, 1)),
      label: 'Solde initial',
      amount: 100,
      status: TransactionStatus.RECONCILED,
      transactionType: TransactionType.INITIAL,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(100),
        currentBalance: new Prisma.Decimal(100),
        pointedBalance: new Prisma.Decimal(100),
        reconciledBalance: new Prisma.Decimal(100),
      },
    ],
    transactionsData,
    [
      { id: 'cat-initial', userId: 'user-123', name: 'Initial' },
      { id: 'cat-other', userId: 'user-123', name: 'Other' },
    ],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(
    () =>
      service.update('acc-1', 'tx-0', {
        categoryId: 'cat-other',
      } as any),
    BadRequestException,
  );
}

async function testUpdateRejectsChangingInitialLinkedTransaction() {
  const transactionsData: TransactionRecord[] = [
    {
      id: 'tx-0',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-initial',
      date: new Date(Date.UTC(2025, 0, 1)),
      label: 'Solde initial',
      amount: 100,
      status: TransactionStatus.RECONCILED,
      transactionType: TransactionType.INITIAL,
      createdAt: new Date(),
      updatedAt: new Date(),
      linkedTransactionId: null,
    },
  ];
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(100),
        currentBalance: new Prisma.Decimal(100),
        pointedBalance: new Prisma.Decimal(100),
        reconciledBalance: new Prisma.Decimal(100),
      },
    ],
    transactionsData,
    [{ id: 'cat-initial', userId: 'user-123', name: 'Initial' }],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(
    () =>
      service.update('acc-1', 'tx-0', {
        linkedTransactionId: 'tx-1',
      } as any),
    BadRequestException,
  );
}

async function testUpdateRejectsChangingInitialTransactionType() {
  const transactionsData: TransactionRecord[] = [
    {
      id: 'tx-0',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-initial',
      date: new Date(Date.UTC(2025, 0, 1)),
      label: 'Solde initial',
      amount: 100,
      status: TransactionStatus.RECONCILED,
      transactionType: TransactionType.INITIAL,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(100),
        currentBalance: new Prisma.Decimal(100),
        pointedBalance: new Prisma.Decimal(100),
        reconciledBalance: new Prisma.Decimal(100),
      },
    ],
    transactionsData,
    [{ id: 'cat-initial', userId: 'user-123', name: 'Initial' }],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(
    () =>
      service.update('acc-1', 'tx-0', {
        transactionType: TransactionType.NONE,
      } as any),
    BadRequestException,
  );
}

async function testUpdateRejectsSettingInitialTypeOnNonInitial() {
  const transactionsData: TransactionRecord[] = [
    {
      id: 'tx-1',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-1',
      date: new Date(Date.UTC(2025, 0, 1)),
      label: 'Regular',
      amount: 10,
      status: TransactionStatus.NONE,
      transactionType: TransactionType.NONE,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    transactionsData,
    [{ id: 'cat-1', userId: 'user-123', name: 'Test' }],
  );
  const { service } = createTransactionsService(prisma);

  await assert.rejects(
    () =>
      service.update('acc-1', 'tx-1', {
        transactionType: TransactionType.INITIAL,
      } as any),
    BadRequestException,
  );
}

async function testUpdateAllowsLinkedTransaction() {
  const transactionsData: TransactionRecord[] = [
    {
      id: 'tx-1',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-1',
      date: new Date(Date.UTC(2025, 0, 1)),
      label: 'Regular',
      amount: 10,
      status: TransactionStatus.NONE,
      transactionType: TransactionType.NONE,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'tx-linked',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: null,
      date: new Date(Date.UTC(2025, 0, 2)),
      label: 'Linked',
      amount: 5,
      status: TransactionStatus.NONE,
      transactionType: TransactionType.NONE,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(15),
        pointedBalance: new Prisma.Decimal(15),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    transactionsData,
    [{ id: 'cat-1', userId: 'user-123', name: 'Test' }],
  );
  const { service } = createTransactionsService(prisma);
  const override = service as any;
  override.recalculateBudgetMonthForUser = async () => null;
  override.emitAccountUpdated = () => undefined;

  const updated = await service.update('acc-1', 'tx-1', {
    linkedTransactionId: 'tx-linked',
  } as any);

  assert.equal(updated.linkedTransactionId, 'tx-linked');
}

async function testRecalculateBudgetMonthForUserEmitsFallback() {
  const prisma = new TransactionsPrismaStub([], [], []);
  const { service, events } = createTransactionsService(prisma);
  const baseMonth = new Date(Date.UTC(2025, 0, 15));
  const override = service as any;
  override.recalculateBudgetMonthSummary = async () => ({
    month: {
      id: 'month-1',
      userId: 'user-123',
      month: new Date(Date.UTC(2025, 0, 1)),
      availableCarryover: 0,
      income: 0,
      assigned: 0,
      available: 0,
      activity: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    months: [],
    categories: [],
  });

  await service.recalculateBudgetMonthForUser(baseMonth, 'user-123');

  const monthEvents = events.emitted.filter((event) => event.event === 'budget.month.updated');
  assert.equal(monthEvents.length, 1);
  assert.equal((monthEvents[0].payload as any).month, '2025-01');
}


async function testFindManyDefaultsAndLimits() {
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(100),
        currentBalance: new Prisma.Decimal(100),
        pointedBalance: new Prisma.Decimal(100),
        reconciledBalance: new Prisma.Decimal(100),
      },
    ],
    [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        accountUserId: 'user-123',
        categoryId: 'cat-1',
        date: new Date(Date.UTC(2025, 0, 1)),
        label: 'A',
        amount: 10,
        status: TransactionStatus.NONE,
        transactionType: TransactionType.NONE,
        createdAt: new Date(Date.UTC(2025, 0, 1, 9)),
        updatedAt: new Date(),
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        accountUserId: 'user-123',
        categoryId: 'cat-2',
        date: new Date(Date.UTC(2025, 0, 5)),
        label: 'B',
        amount: 20,
        status: TransactionStatus.NONE,
        transactionType: TransactionType.NONE,
        createdAt: new Date(Date.UTC(2025, 0, 5, 9)),
        updatedAt: new Date(),
      },
      {
        id: 'tx-3',
        accountId: 'acc-1',
        accountUserId: 'user-123',
        categoryId: 'cat-3',
        date: new Date(Date.UTC(2025, 0, 10)),
        label: 'C',
        amount: -5,
        status: TransactionStatus.NONE,
        transactionType: TransactionType.NONE,
        createdAt: new Date(Date.UTC(2025, 0, 10, 9)),
        updatedAt: new Date(),
      },
    ],
    [
      { id: 'cat-1', userId: 'user-123', name: 'Cat1' },
      { id: 'cat-2', userId: 'user-123', name: 'Cat2' },
      { id: 'cat-3', userId: 'user-123', name: 'Cat3' },
    ],
  );
  const { service } = createTransactionsService(prisma);
  (service as any).computeRunningBalances = () => new Map();

  const defaults = await service.findMany('acc-1', {} as any);
  assert.equal(defaults.meta.take, 50);
  assert.equal(defaults.meta.skip, 0);
  assert.equal(defaults.items[0].balance, 0);

  const maxed = await service.findMany('acc-1', { take: 999, skip: 1 } as any);
  assert.equal(maxed.meta.take, 200);
  assert.equal(maxed.meta.skip, 1);

  const fromOnly = await service.findMany('acc-1', { from: '2025-01-05' } as any);
  assert.equal(fromOnly.items.length, 2);

  const toOnly = await service.findMany('acc-1', { to: '2025-01-05' } as any);
  assert.equal(toOnly.items.length, 2);
}

async function testFindOneUsesDefaultBalanceWhenMissing() {
  const existing: TransactionRecord = {
    id: 'tx-existing',
    accountId: 'acc-1',
    accountUserId: 'user-123',
    categoryId: 'cat-income',
    date: new Date(Date.UTC(2025, 2, 1)),
    label: 'Salaire Mars',
    amount: 900,
    status: TransactionStatus.NONE,
    transactionType: TransactionType.NONE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    [existing],
    [{ id: 'cat-income', userId: 'user-123', name: 'Salaire' }],
  );
  const { service } = createTransactionsService(prisma);
  (service as any).recalculateRunningMap = async () => new Map();

  const entity = await service.findOne('acc-1', 'tx-existing');
  assert.equal(entity.balance, 0);
}

async function testUpdateWithExplicitStatusDateAndType() {
  const transactionsData: TransactionRecord[] = [
    {
      id: 'tx-1',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-1',
      date: new Date(Date.UTC(2025, 0, 1)),
      label: 'Regular',
      amount: 10,
      status: TransactionStatus.NONE,
      transactionType: TransactionType.NONE,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(10),
        pointedBalance: new Prisma.Decimal(10),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    transactionsData,
    [{ id: 'cat-1', userId: 'user-123', name: 'Test' }],
  );
  const { service } = createTransactionsService(prisma);
  const override = service as any;
  override.recalculateBudgetMonthForUser = async () => null;
  override.emitAccountUpdated = () => undefined;
  override.recalculateRunningMap = async () => new Map();

  const updated = await service.update('acc-1', 'tx-1', {
    status: TransactionStatus.RECONCILED,
    transactionType: TransactionType.NONE,
    date: '2025-02-01',
  } as any);

  assert.equal(updated.status, TransactionStatus.RECONCILED);
  assert.equal(updated.transactionType, TransactionType.NONE);
  assert.equal(updated.balance, 0);
  assert.equal(updated.date.startsWith('2025-02-01'), true);
}

async function testRemoveUsesDefaultBalanceWhenMissing() {
  const transactionsData: TransactionRecord[] = [
    {
      id: 'tx-1',
      accountId: 'acc-1',
      accountUserId: 'user-123',
      categoryId: 'cat-1',
      date: new Date(Date.UTC(2025, 0, 5)),
      label: 'Courses',
      amount: -40,
      status: TransactionStatus.NONE,
      transactionType: TransactionType.NONE,
      createdAt: new Date(Date.UTC(2025, 0, 5, 10)),
      updatedAt: new Date(Date.UTC(2025, 0, 5, 10)),
    },
  ];
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(100),
        currentBalance: new Prisma.Decimal(60),
        pointedBalance: new Prisma.Decimal(100),
        reconciledBalance: new Prisma.Decimal(100),
      },
    ],
    transactionsData,
    [{ id: 'cat-1', userId: 'user-123', name: 'Courses' }],
  );
  const { service } = createTransactionsService(prisma);
  const override = service as any;
  override.recalculateRunningMap = async () => new Map();
  override.recalculateBudgetMonthForUser = async () => null;
  override.emitAccountUpdated = () => undefined;

  const entity = await service.remove('acc-1', 'tx-1');
  assert.equal(entity.balance, 0);
}

async function testCreateInitialTransactionWithOverrides() {
  const prisma = new TransactionsPrismaStub(
    [
      {
        id: 'acc-1',
        userId: 'user-123',
        initialBalance: new Prisma.Decimal(0),
        currentBalance: new Prisma.Decimal(0),
        pointedBalance: new Prisma.Decimal(0),
        reconciledBalance: new Prisma.Decimal(0),
      },
    ],
    [],
    [{ id: 'cat-initial', userId: 'user-123', name: 'Initial' }],
  );
  const { service } = createTransactionsService(prisma);
  const override = service as any;
  override.recalculateAccountBalances = async () => ({
    id: 'acc-1',
    userId: 'user-123',
    name: 'Compte courant',
    initialBalance: new Prisma.Decimal(0),
    currentBalance: new Prisma.Decimal(0),
    pointedBalance: new Prisma.Decimal(0),
    reconciledBalance: new Prisma.Decimal(0),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  override.recalculateRunningMap = async () => new Map();
  override.recalculateBudgetMonthForUser = async () => null;
  override.emitAccountUpdated = () => undefined;

  const entity = await service.createInitialTransactionForAccount('acc-1', {
    amount: undefined as any,
    categoryId: 'cat-initial',
    label: 'Initial custom',
    status: TransactionStatus.POINTED,
  });

  assert.equal(entity.label, 'Initial custom');
  assert.equal(entity.status, TransactionStatus.POINTED);
  assert.equal(entity.amount, 0);
  assert.equal(entity.balance, 0);
}

async function testRecalculateBudgetMonthForUserEmitsUpdates() {
  const prisma = new TransactionsPrismaStub([], [], []);
  const { service, events } = createTransactionsService(prisma);
  const override = service as any;
  override.recalculateBudgetMonthSummary = async () => ({
    month: {
      id: 'month-1',
      userId: 'user-123',
      month: new Date(Date.UTC(2025, 0, 1)),
      availableCarryover: 0,
      income: 0,
      assigned: 0,
      available: 0,
      activity: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    months: ['2025-01'],
    categories: [
      { month: '2025-01', category: { id: 'cat-1' } },
    ],
  });

  await service.recalculateBudgetMonthForUser(new Date(Date.UTC(2025, 0, 1)));

  assert.equal(events.emitted.some((event) => event.event === 'budget.category.updated'), true);
  assert.equal(events.emitted.some((event) => event.event === 'budget.month.updated'), true);
}

(async () => {
  await testFindManyReturnsFormattedResults();
  await testFindManyDefaultsAndLimits();
  await testFindManyThrowsWhenAccountMissing();
  await testCreateThrowsWhenAccountMissing();
  await testCreateValidTransaction();
  await testCreateRejectsInitialType();
  await testCreateRejectsUnknownCategory();
  await testCreateRejectsUnknownLinkedTransaction();
  await testCreateWithLinkedTransactionAcceptsOwned();
  await testCreateInitialTransaction();
  await testCreateInitialTransactionWithOverrides();
  await testCreateInitialTransactionRejectsMissingCategory();
  await testCreateInitialTransactionRejectsInvalidDate();
  await testCreateInitialTransactionThrowsWhenAccountMissing();
  await testFindOneReturnsTransaction();
  await testFindOneUsesDefaultBalanceWhenMissing();
  await testFindOneThrowsWhenTransactionMissing();
  await testFindOneThrowsWhenAccountMissing();
  await testUpdateTransactionAdjustsBalances();
  await testUpdateThrowsWhenAccountMissing();
  await testUpdateThrowsWhenTransactionMissing();
  await testUpdateRejectsChangingInitialCategory();
  await testUpdateRejectsChangingInitialLinkedTransaction();
  await testUpdateRejectsChangingInitialTransactionType();
  await testUpdateRejectsSettingInitialTypeOnNonInitial();
  await testUpdateAllowsLinkedTransaction();
  await testUpdateWithExplicitStatusDateAndType();
  await testUpdateInitialTransactionRejectsLabelChange();
  await testRemoveTransactionDeletesRecord();
  await testRemoveRejectsInitialTransaction();
  await testRemoveUsesDefaultBalanceWhenMissing();
  await testUpdateThrowsForUnknownCategory();
  await testUpdateThrowsForForeignLinkedTransaction();
  await testFindOneIncludesLinkedTransaction();
  await testRemoveThrowsWhenAccountMissing();
  await testRemoveThrowsWhenTransactionMissing();
  await testRecalculateBudgetMonthForUserEmitsFallback();
  await testRecalculateBudgetMonthForUserEmitsUpdates();
  console.log('Transactions service tests passed ✓');
})();
