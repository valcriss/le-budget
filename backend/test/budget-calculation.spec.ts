import { strict as assert } from 'assert';
import {
  CategoryKind,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { TransactionsService } from '../src/modules/transactions/transactions.service';
import { MockPrismaClient } from './utils/mock-prisma-client';

const USER_ID = 'user-1';

function createService(prisma: MockPrismaClient): TransactionsService {
  const events = { emit: () => undefined };
  const userContext = { getUserId: () => USER_ID };
  return new TransactionsService(prisma as unknown as any, events as any, userContext as any);
}

async function recalcMonth(
  service: TransactionsService,
  prisma: MockPrismaClient,
  monthStart: Date,
) {
  await service.recalculateBudgetMonthForUser(monthStart, USER_ID);
}

async function testCarryoverFromPreviousMonth() {
  const monthOctober = new Date(Date.UTC(2025, 9, 1));
  const monthDecember = new Date(Date.UTC(2025, 11, 1));

  const prisma = new MockPrismaClient({
    budgetMonths: [
      {
        id: 'month-october',
        userId: USER_ID,
        month: monthOctober,
        income: 2000,
        availableCarryover: 0,
        assigned: 0,
        activity: 0,
        available: 2000,
      },
      {
        id: 'month-december',
        userId: USER_ID,
        month: monthDecember,
        income: 0,
        availableCarryover: 0,
        assigned: 0,
        activity: 0,
        available: 0,
      },
    ],
    budgetCategoryGroups: [
      { id: 'group-october', monthId: 'month-october', categoryId: 'parent' },
      { id: 'group-december', monthId: 'month-december', categoryId: 'parent' },
    ],
    budgetCategories: [
      {
        id: 'budget-october',
        groupId: 'group-october',
        categoryId: 'expense-cat',
        assigned: 0,
        activity: -150,
        available: -150,
      },
      {
        id: 'budget-december',
        groupId: 'group-december',
        categoryId: 'expense-cat',
        assigned: 0,
        activity: 0,
        available: 0,
      },
    ],
    transactions: [
      {
        id: 'tx-spend',
        accountId: 'account-1',
        accountUserId: USER_ID,
        categoryId: 'expense-cat',
        categoryKind: CategoryKind.EXPENSE,
        date: new Date(Date.UTC(2025, 9, 6)),
        amount: -150,
        transactionType: TransactionType.NONE,
        status: TransactionStatus.NONE,
      },
      {
        id: 'tx-income',
        accountId: 'account-1',
        accountUserId: USER_ID,
        categoryId: 'income-cat',
        categoryKind: CategoryKind.INCOME,
        date: new Date(Date.UTC(2025, 9, 1)),
        amount: 2000,
        transactionType: TransactionType.NONE,
        status: TransactionStatus.NONE,
      },
    ],
    categories: [
      { id: 'parent', userId: USER_ID, kind: CategoryKind.EXPENSE, parentCategoryId: null },
      { id: 'expense-cat', userId: USER_ID, kind: CategoryKind.EXPENSE, parentCategoryId: 'parent' },
      { id: 'income-cat', userId: USER_ID, kind: CategoryKind.INCOME, parentCategoryId: null },
    ],
  });

  const service = createService(prisma);

  await recalcMonth(service, prisma, monthOctober);
  const updatedOctober = prisma.getMonth('month-october');
  assert(updatedOctober, 'October month not found after recalculation');
  assert.equal(updatedOctober?.income, 2000);
  assert.equal(updatedOctober?.activity, -150);
  assert.equal(updatedOctober?.available, 2000);

  await recalcMonth(service, prisma, monthDecember);
  const updatedDecember = prisma.getMonth('month-december');
  assert(updatedDecember, 'December month not found after recalculation');
  assert.equal(updatedDecember?.availableCarryover, 2000);
  assert.equal(updatedDecember?.available, 2000);
  assert.equal(updatedDecember?.income, 0);
  assert.equal(updatedDecember?.assigned, 0);
}

async function testWithinBudgetSpendingKeepsBalance() {
  const month = new Date(Date.UTC(2025, 0, 1));

  const prisma = new MockPrismaClient({
    budgetMonths: [
      {
        id: 'month-january',
        userId: USER_ID,
        month,
        income: 0,
        availableCarryover: 0,
        assigned: 0,
        activity: 0,
        available: 0,
      },
    ],
    budgetCategoryGroups: [{ id: 'group-jan', monthId: 'month-january', categoryId: 'parent' }],
    budgetCategories: [
      {
        id: 'budget-jan',
        groupId: 'group-jan',
        categoryId: 'expense-cat',
        assigned: 100,
        activity: -50,
        available: 50,
      },
    ],
    transactions: [
      {
        id: 'tx-income',
        accountId: 'account-1',
        accountUserId: USER_ID,
        categoryId: 'income-cat',
        categoryKind: CategoryKind.INCOME,
        date: new Date(Date.UTC(2025, 0, 2)),
        amount: 100,
        transactionType: TransactionType.NONE,
        status: TransactionStatus.NONE,
      },
      {
        id: 'tx-spend',
        accountId: 'account-1',
        accountUserId: USER_ID,
        categoryId: 'expense-cat',
        categoryKind: CategoryKind.EXPENSE,
        date: new Date(Date.UTC(2025, 0, 5)),
        amount: -50,
        transactionType: TransactionType.NONE,
        status: TransactionStatus.NONE,
      },
    ],
    categories: [
      { id: 'parent', userId: USER_ID, kind: CategoryKind.EXPENSE, parentCategoryId: null },
      { id: 'expense-cat', userId: USER_ID, kind: CategoryKind.EXPENSE, parentCategoryId: 'parent' },
      { id: 'income-cat', userId: USER_ID, kind: CategoryKind.INCOME, parentCategoryId: null },
    ],
  });

  const service = createService(prisma);

  await recalcMonth(service, prisma, month);
  const updatedJanuary = prisma.getMonth('month-january');
  assert(updatedJanuary, 'January month not found after recalculation');
  assert.equal(updatedJanuary?.income, 100);
  assert.equal(updatedJanuary?.activity, -50);
  assert.equal(updatedJanuary?.assigned, 100);
  assert.equal(updatedJanuary?.available, 0);
}

async function testRefundUpdatesCategoryActivity() {
  const month = new Date(Date.UTC(2025, 10, 1));

  const prisma = new MockPrismaClient({
    budgetMonths: [
      {
        id: 'month-november',
        userId: USER_ID,
        month,
        income: 0,
        availableCarryover: 0,
        assigned: 0,
        activity: 0,
        available: 0,
      },
    ],
    budgetCategoryGroups: [{ id: 'group-november', monthId: 'month-november', categoryId: 'parent' }],
    budgetCategories: [
      {
        id: 'budget-november',
        groupId: 'group-november',
        categoryId: 'expense-cat',
        assigned: 0,
        activity: 0,
        available: 0,
      },
    ],
    transactions: [
      {
        id: 'tx-refund',
        accountId: 'account-1',
        accountUserId: USER_ID,
        categoryId: 'expense-cat',
        categoryKind: CategoryKind.EXPENSE,
        date: new Date(Date.UTC(2025, 10, 12)),
        amount: 150,
        transactionType: TransactionType.NONE,
        status: TransactionStatus.NONE,
      },
    ],
    categories: [
      { id: 'parent', userId: USER_ID, kind: CategoryKind.EXPENSE, parentCategoryId: null },
      { id: 'expense-cat', userId: USER_ID, kind: CategoryKind.EXPENSE, parentCategoryId: 'parent' },
    ],
  });

  const service = createService(prisma);

  await recalcMonth(service, prisma, month);
  const updatedCategory = prisma.getBudgetCategory('budget-november');
  assert(updatedCategory, 'Budget category not found after recalculation');
  assert.equal(updatedCategory?.activity, 150);
  assert.equal(updatedCategory?.available, 150);
}

async function main() {
  await testCarryoverFromPreviousMonth();
  await testWithinBudgetSpendingKeepsBalance();
  await testRefundUpdatesCategoryActivity();
  console.log('Budget calculation tests passed ✓');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
