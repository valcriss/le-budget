import { strict as assert } from 'assert';
import { CategoryKind } from '@prisma/client';
import { AccountEntity } from '../src/modules/accounts/entities/account.entity';
import { BudgetCategoryEntity } from '../src/modules/budget/entities/budget-category.entity';
import { BudgetCategoryGroupEntity } from '../src/modules/budget/entities/budget-group.entity';
import { BudgetMonthEntity } from '../src/modules/budget/entities/budget-month.entity';
import { CategoryEntity } from '../src/modules/categories/entities/category.entity';
import { TransactionEntity } from '../src/modules/transactions/entities/transaction.entity';
import { TransactionsListEntity } from '../src/modules/transactions/entities/transactions-list.entity';

function createAccount(): AccountEntity {
  return Object.assign(new AccountEntity(), {
    id: 'acc-1',
    name: 'Compte',
    type: 'CHECKING',
    currency: 'EUR',
    initialBalance: 0,
    currentBalance: 10,
    reconciledBalance: 10,
    pointedBalance: 10,
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function testAccountEntityHasPositiveBalance() {
  const entity = createAccount();
  assert.equal(entity.hasPositiveBalance(), true);
  entity.currentBalance = -5;
  assert.equal(entity.hasPositiveBalance(), false);
}

async function testBudgetCategoryEntityAvailableFunds() {
  const entity = Object.assign(new BudgetCategoryEntity(), {
    id: 'budget-1',
    groupId: 'group-1',
    categoryId: 'cat-1',
    category: new CategoryEntity(),
    assigned: 0,
    activity: 0,
    available: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.equal(entity.hasAvailableFunds(), true);
  entity.available = 0;
  assert.equal(entity.hasAvailableFunds(), false);
}

async function testBudgetGroupEntityHasItems() {
  const group = Object.assign(new BudgetCategoryGroupEntity(), {
    id: 'group-1',
    monthId: 'month',
    categoryId: 'cat',
    category: new CategoryEntity(),
    assigned: 0,
    activity: 0,
    available: 0,
    items: [Object.assign(new BudgetCategoryEntity(), { available: 0 })],
  });
  assert.equal(group.hasItems(), true);
  group.items = [];
  assert.equal(group.hasItems(), false);
}

async function testBudgetMonthEntityHasSurplus() {
  const month = Object.assign(new BudgetMonthEntity(), {
    id: 'month',
    month: '2025-01',
    availableCarryover: 0,
    income: 0,
    assigned: 0,
    activity: 0,
    available: 10,
    totalAssigned: 0,
    totalActivity: 0,
    totalAvailable: 10,
    groups: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.equal(month.hasSurplus(), true);
  month.available = -1;
  assert.equal(month.hasSurplus(), false);
}

async function testCategoryEntityTransferDetection() {
  const category = Object.assign(new CategoryEntity(), {
    id: 'cat',
    name: 'Transfer',
    kind: CategoryKind.TRANSFER,
    sortOrder: 0,
    parentCategoryId: null,
    linkedAccountId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.equal(category.isTransferCategory(), true);
  category.kind = CategoryKind.EXPENSE;
  assert.equal(category.isTransferCategory(), false);
}

async function testTransactionEntityCreditHelper() {
  const txn = Object.assign(new TransactionEntity(), {
    id: 'tx',
    accountId: 'acc',
    date: new Date().toISOString(),
    label: 'Revenus',
    categoryId: null,
    categoryName: null,
    amount: 25,
    debit: undefined,
    credit: 25,
    balance: 25,
    status: 'NONE',
    transactionType: 'NONE',
    linkedTransactionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  assert.equal(txn.isCredit(), true);
  txn.amount = -1;
  assert.equal(txn.isCredit(), false);
}

async function testTransactionsListEntityHasItems() {
  const list = Object.assign(new TransactionsListEntity(), {
    items: [
      Object.assign(new TransactionEntity(), {
        id: 'tx',
        accountId: 'acc',
        date: new Date().toISOString(),
        label: 'Test',
        amount: 0,
        balance: 0,
        status: 'NONE',
        transactionType: 'NONE',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ],
    meta: { total: 1, skip: 0, take: 1 },
  });
  assert.equal(list.hasItems(), true);
  list.items = [];
  assert.equal(list.hasItems(), false);
}

(async () => {
  await testAccountEntityHasPositiveBalance();
  await testBudgetCategoryEntityAvailableFunds();
  await testBudgetGroupEntityHasItems();
  await testBudgetMonthEntityHasSurplus();
  await testCategoryEntityTransferDetection();
  await testTransactionEntityCreditHelper();
  await testTransactionsListEntityHasItems();
  console.log('Entity helper tests passed ✓');
})();
