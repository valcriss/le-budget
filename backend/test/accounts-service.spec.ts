import { strict as assert } from 'assert';
import { NotFoundException } from '@nestjs/common';
import { AccountType, CategoryKind, Prisma, TransactionType } from '@prisma/client';
import { AccountsService } from '../src/modules/accounts/accounts.service';

type AccountRecord = {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  currency: string;
  archived: boolean;
  initialBalance: Prisma.Decimal;
  currentBalance: Prisma.Decimal;
  reconciledBalance: Prisma.Decimal;
  pointedBalance: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
};

type CategoryRecord = {
  id: string;
  userId: string;
  name: string;
  kind: CategoryKind;
  sortOrder: number;
  parentCategoryId: string | null;
  linkedAccountId?: string | null;
};

class AccountsPrismaStub {
  private settings = new Map<string, { currency: string }>();
  public accounts: AccountRecord[] = [];
  public categories: CategoryRecord[] = [];
  public transactions: Array<{ accountId: string; transactionType: TransactionType; amount: Prisma.Decimal }> = [];

  constructor(accounts: AccountRecord[] = [], categories: CategoryRecord[] = []) {
    this.accounts = accounts;
    this.categories = categories;
  }

  userSettings = {
    upsert: async ({ where, create }: { where: { userId: string }; create: { userId: string } }) => {
      if (!this.settings.has(where.userId)) {
        this.settings.set(where.userId, { currency: 'EUR' });
      }
      return this.settings.get(create.userId)!;
    },
  };

  account = {
    create: async ({ data }: { data: any }) => {
      const record: AccountRecord = {
        id: `acc-${this.accounts.length + 1}`,
        userId: data.userId,
        name: data.name,
        type: data.type ?? AccountType.CHECKING,
        currency: data.currency,
        archived: data.archived ?? false,
        initialBalance: new Prisma.Decimal(data.initialBalance),
        currentBalance: new Prisma.Decimal(data.currentBalance),
        reconciledBalance: new Prisma.Decimal(data.reconciledBalance),
        pointedBalance: new Prisma.Decimal(data.pointedBalance),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.accounts.push(record);
      return { ...record };
    },

    findMany: async ({ where }: { where: { userId: string } }) => {
      return this.accounts.filter((acc) => acc.userId === where.userId).map((acc) => ({ ...acc }));
    },

    findFirst: async ({ where }: { where: { id?: string; userId: string } }) => {
      const record = this.accounts.find((acc) => (!where.id || acc.id === where.id) && acc.userId === where.userId);
      return record ? { ...record } : null;
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const record = this.accounts.find((acc) => acc.id === where.id);
      if (!record) {
        throw new Error('Account not found');
      }
      if (data.name !== undefined) record.name = data.name;
      if (data.type !== undefined) record.type = data.type;
      if (data.currency !== undefined) record.currency = data.currency;
      if (data.archived !== undefined) record.archived = data.archived;
      if (data.initialBalance instanceof Prisma.Decimal) {
        record.initialBalance = data.initialBalance;
      }
      if (data.reconciledBalance instanceof Prisma.Decimal) {
        record.reconciledBalance = data.reconciledBalance;
      }
      if (data.currentBalance?.increment instanceof Prisma.Decimal) {
        record.currentBalance = record.currentBalance.plus(data.currentBalance.increment);
      } else if (data.currentBalance instanceof Prisma.Decimal) {
        record.currentBalance = data.currentBalance;
      }
      if ((data as any).pointedBalance?.increment instanceof Prisma.Decimal) {
        record.pointedBalance = record.pointedBalance.plus((data as any).pointedBalance.increment);
      } else if ((data as any).pointedBalance instanceof Prisma.Decimal) {
        record.pointedBalance = (data as any).pointedBalance;
      }
      record.updatedAt = new Date();
      return { ...record };
    },
  };

  transaction = {
    updateMany: async ({
      where,
      data,
    }: {
      where: { accountId: string; transactionType: TransactionType };
      data: { amount: Prisma.Decimal };
    }) => {
      this.transactions.push({
        accountId: where.accountId,
        transactionType: where.transactionType,
        amount: data.amount,
      });
      return { count: 1 };
    },
  };

  category = {
    findFirst: async ({ where }: { where: { userId: string; kind: CategoryKind } }) => {
      const record = this.categories.find((cat) => cat.userId === where.userId && cat.kind === where.kind);
      if (!record) {
        return null;
      }
      return { id: record.id };
    },

    findMany: async ({ where }: { where: { userId: string; OR: Array<{ name: string }> } }) => {
      return this.categories
        .filter((cat) => cat.userId === where.userId && where.OR.some((o) => o.name === cat.name))
        .map((cat) => ({ id: cat.id, name: cat.name }));
    },

    aggregate: async ({ where }: { where: { userId: string; parentCategoryId: null } }) => {
      const sorted = this.categories
        .filter((cat) => cat.userId === where.userId && cat.parentCategoryId === where.parentCategoryId)
        .map((cat) => cat.sortOrder);
      const max = sorted.length > 0 ? Math.max(...sorted) : null;
      return { _max: { sortOrder: max } };
    },

    create: async ({ data }: { data: any }) => {
      const record: CategoryRecord = {
        id: `cat-${this.categories.length + 1}`,
        userId: data.userId,
        name: data.name,
        kind: data.kind,
        sortOrder: data.sortOrder ?? 0,
        parentCategoryId: data.parentCategoryId ?? null,
        linkedAccountId: data.linkedAccountId ?? null,
      };
      this.categories.push(record);
      return { ...record };
    },
  };
}

class StubEvents {
  public emitted: Array<{ event: string; payload: unknown }> = [];
  emit(event: string, payload: unknown) {
    this.emitted.push({ event, payload });
  }
}

class StubTransactions {
  public initialCalls: Array<{ accountId: string; amount: number; categoryId: string }> = [];

  async createInitialTransactionForAccount(
    accountId: string,
    options: { amount: number; categoryId: string },
  ) {
    this.initialCalls.push({ accountId, amount: options.amount, categoryId: options.categoryId });
    return undefined as any;
  }
}

class StubUserContext {
  constructor(private readonly userId: string) {}
  getUserId() {
    return this.userId;
  }
}

function createService(prisma: AccountsPrismaStub) {
  const events = new StubEvents();
  const transactions = new StubTransactions();
  const userContext = new StubUserContext('user-123');
  const service = new AccountsService(prisma as any, events as any, transactions as any, userContext as any);
  return { service, events, transactions };
}

async function testCreateAccountGeneratesCategoriesAndTransaction() {
  const prisma = new AccountsPrismaStub();
  const { service, events, transactions } = createService(prisma);

  const entity = await service.create({
    name: 'Compte courant',
    initialBalance: 250,
  } as any);

  assert.equal(entity.name, 'Compte courant');
  assert.equal(transactions.initialCalls.length, 1);
  assert.equal(transactions.initialCalls[0].amount, 250);
  assert.equal(events.emitted.some((event) => event.event === 'account.created'), true);
  const categoryNames = prisma.categories.map((c) => c.name);
  assert(categoryNames.includes('Solde initial'));
  assert(categoryNames.includes('Revenus du mois'));
  assert(categoryNames.includes('Revenus du mois suivant'));
  assert(categoryNames.some((name) => name.startsWith('Virement')));
}

async function testCreateSkipsExistingIncomeCategories() {
  const prisma = new AccountsPrismaStub([], [
    {
      id: 'cat-1',
      userId: 'user-123',
      name: 'Revenus du mois',
      kind: CategoryKind.INCOME,
      sortOrder: 0,
      parentCategoryId: null,
    },
    {
      id: 'cat-2',
      userId: 'user-123',
      name: 'Revenus du mois suivant',
      kind: CategoryKind.INCOME_PLUS_ONE,
      sortOrder: 1,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  await service.create({
    name: 'Compte épargne',
    initialBalance: 0,
  } as any);

  const incomeCount = prisma.categories.filter((cat) => cat.name.startsWith('Revenus')).length;
  assert.equal(incomeCount, 2);
}

async function testUpdateAdjustsBalancesAndTransactions() {
  const existing: AccountRecord = {
    id: 'acc-1',
    userId: 'user-123',
    name: 'Compte courant',
    type: AccountType.CHECKING,
    currency: 'eur',
    archived: false,
    initialBalance: new Prisma.Decimal(100),
    currentBalance: new Prisma.Decimal(100),
    reconciledBalance: new Prisma.Decimal(100),
    pointedBalance: new Prisma.Decimal(100),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = new AccountsPrismaStub([existing]);
  const { service, events } = createService(prisma);

  const updated = await service.update('acc-1', {
    name: 'Compte courant modifié',
    initialBalance: 150,
    reconciledBalance: 120,
    currency: 'usd',
  } as any);

  assert.equal(updated.name, 'Compte courant modifié');
  assert.equal(updated.currency, 'USD');
  assert.equal(Number(updated.initialBalance), 150);
  assert.equal(events.emitted.some((event) => event.event === 'account.updated'), true);
  assert.equal(prisma.transactions.length, 1);
  assert.equal(Number(prisma.accounts[0].currentBalance), 150);
}

async function testRemoveArchivesAccount() {
  const existing: AccountRecord = {
    id: 'acc-1',
    userId: 'user-123',
    name: 'Compte courant',
    type: AccountType.CHECKING,
    currency: 'EUR',
    archived: false,
    initialBalance: new Prisma.Decimal(0),
    currentBalance: new Prisma.Decimal(0),
    reconciledBalance: new Prisma.Decimal(0),
    pointedBalance: new Prisma.Decimal(0),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = new AccountsPrismaStub([existing]);
  const { service, events } = createService(prisma);

  const entity = await service.remove('acc-1');
  assert.equal(entity.archived, true);
  assert.equal(events.emitted.some((event) => event.event === 'account.archived'), true);
}

async function testRemoveThrowsWhenAccountMissing() {
  const prisma = new AccountsPrismaStub();
  const { service } = createService(prisma);

  await assert.rejects(() => service.remove('missing'), NotFoundException);
}

async function testFindAllReturnsEntities() {
  const existing: AccountRecord = {
    id: 'acc-1',
    userId: 'user-123',
    name: 'Compte courant',
    type: AccountType.CHECKING,
    currency: 'EUR',
    archived: false,
    initialBalance: new Prisma.Decimal(50),
    currentBalance: new Prisma.Decimal(75),
    reconciledBalance: new Prisma.Decimal(60),
    pointedBalance: new Prisma.Decimal(70),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = new AccountsPrismaStub([existing]);
  const { service } = createService(prisma);

  const items = await service.findAll();
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'Compte courant');
  assert.equal(items[0].currentBalance, 75);
}

async function testFindOneThrowsWhenMissing() {
  const prisma = new AccountsPrismaStub();
  const { service } = createService(prisma);

  await assert.rejects(() => service.findOne('acc-unknown'), NotFoundException);
}

async function testFindOneReturnsEntity() {
  const existing: AccountRecord = {
    id: 'acc-1',
    userId: 'user-123',
    name: 'Compte courant',
    type: AccountType.CHECKING,
    currency: 'eur',
    archived: false,
    initialBalance: new Prisma.Decimal(10),
    currentBalance: new Prisma.Decimal(15),
    reconciledBalance: new Prisma.Decimal(12),
    pointedBalance: new Prisma.Decimal(14),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = new AccountsPrismaStub([existing]);
  const { service } = createService(prisma);

  const entity = await service.findOne('acc-1');
  assert.equal(entity.name, 'Compte courant');
  assert.equal(entity.currentBalance, 15);
}

async function testUpdateThrowsWhenAccountMissing() {
  const prisma = new AccountsPrismaStub();
  const { service } = createService(prisma);

  await assert.rejects(() => service.update('missing', {} as any), NotFoundException);
}

async function testUpdateWithoutInitialBalanceSkipsTransactionUpdate() {
  const existing: AccountRecord = {
    id: 'acc-1',
    userId: 'user-123',
    name: 'Compte courant',
    type: AccountType.CHECKING,
    currency: 'eur',
    archived: false,
    initialBalance: new Prisma.Decimal(100),
    currentBalance: new Prisma.Decimal(100),
    reconciledBalance: new Prisma.Decimal(100),
    pointedBalance: new Prisma.Decimal(100),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = new AccountsPrismaStub([existing]);
  const { service } = createService(prisma);

  await service.update('acc-1', {
    name: 'Renommé',
  } as any);

  assert.equal(prisma.transactions.length, 0);
}

async function testCreateUsesUppercaseCurrencyFromSettings() {
  const prisma = new AccountsPrismaStub();
  const { service } = createService(prisma);

  const entity = await service.create({
    name: 'Compte usd',
    currency: 'usd',
    initialBalance: 0,
  } as any);

  assert.equal(entity.currency, 'USD');
}


async function testCreateUsesExistingInitialCategory() {
  const prisma = new AccountsPrismaStub([], [
    {
      id: 'cat-initial',
      userId: 'user-123',
      name: 'Solde initial',
      kind: CategoryKind.INITIAL,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  await service.create({
    name: 'Compte courant',
    initialBalance: 0,
  } as any);

  const initialCategories = prisma.categories.filter((cat) => cat.kind === CategoryKind.INITIAL);
  assert.equal(initialCategories.length, 1);
  assert.equal(initialCategories[0].id, 'cat-initial');
}

async function testCreateAddsMissingIncomeCategory() {
  const prisma = new AccountsPrismaStub([], [
    {
      id: 'cat-income',
      userId: 'user-123',
      name: 'Revenus du mois',
      kind: CategoryKind.INCOME,
      sortOrder: 0,
      parentCategoryId: null,
    },
  ]);
  const { service } = createService(prisma);

  await service.create({
    name: 'Compte courant',
    initialBalance: 0,
  } as any);

  const incomeNames = prisma.categories
    .filter((cat) => cat.name.startsWith('Revenus'))
    .map((cat) => cat.name);
  assert.equal(incomeNames.includes('Revenus du mois'), true);
  assert.equal(incomeNames.includes('Revenus du mois suivant'), true);
}


async function testCreateRespectsReconciledBalanceAndType() {
  const prisma = new AccountsPrismaStub();
  const { service } = createService(prisma);

  const entity = await service.create({
    name: 'Compte special',
    initialBalance: 100,
    reconciledBalance: 80,
    type: AccountType.SAVINGS,
    archived: true,
  } as any);

  assert.equal(entity.type, AccountType.SAVINGS);
  assert.equal(entity.archived, true);
  assert.equal(Number(entity.reconciledBalance), 80);
}

async function testCreateFallsBackToDefaultCurrencyWhenSettingsMissing() {
  const prisma = new AccountsPrismaStub();
  (prisma as any).settings.set('user-123', { currency: undefined });
  const { service } = createService(prisma);

  const entity = await service.create({
    name: 'Compte sans devise',
  } as any);

  assert.equal(entity.currency, 'EUR');
  assert.equal(Number(entity.initialBalance), 0);
}

async function testUpdateKeepsExistingNameAndCurrency() {
  const existing: AccountRecord = {
    id: 'acc-1',
    userId: 'user-123',
    name: 'Compte courant',
    type: AccountType.CHECKING,
    currency: 'CHF',
    archived: false,
    initialBalance: new Prisma.Decimal(10),
    currentBalance: new Prisma.Decimal(10),
    reconciledBalance: new Prisma.Decimal(10),
    pointedBalance: new Prisma.Decimal(10),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = new AccountsPrismaStub([existing]);
  const { service } = createService(prisma);

  const updated = await service.update('acc-1', {
    type: AccountType.SAVINGS,
    archived: true,
  } as any);

  assert.equal(updated.name, 'Compte courant');
  assert.equal(updated.currency, 'CHF');
  assert.equal(updated.type, AccountType.SAVINGS);
  assert.equal(updated.archived, true);
}

(async () => {
  await testCreateAccountGeneratesCategoriesAndTransaction();
  await testCreateSkipsExistingIncomeCategories();
  await testCreateUsesExistingInitialCategory();
  await testCreateAddsMissingIncomeCategory();
  await testCreateUsesUppercaseCurrencyFromSettings();
  await testCreateRespectsReconciledBalanceAndType();
  await testCreateFallsBackToDefaultCurrencyWhenSettingsMissing();
  await testUpdateAdjustsBalancesAndTransactions();
  await testUpdateKeepsExistingNameAndCurrency();
  await testUpdateWithoutInitialBalanceSkipsTransactionUpdate();
  await testUpdateThrowsWhenAccountMissing();
  await testRemoveArchivesAccount();
  await testRemoveThrowsWhenAccountMissing();
  await testFindAllReturnsEntities();
  await testFindOneThrowsWhenMissing();
  await testFindOneReturnsEntity();
  console.log('Accounts service tests passed ✓');
})();
