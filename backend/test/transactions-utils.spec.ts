import { strict as assert } from 'assert';
import { TransactionType } from '@prisma/client';
import { TransactionsService } from '../src/modules/transactions/transactions.service';

class StubPrismaService {}

class StubEventsService {
  emit() {
    // noop
  }
}

class StubUserContext {
  getUserId() {
    return 'user-123';
  }
}

function createService() {
  return new TransactionsService(
    new StubPrismaService() as any,
    new StubEventsService() as any,
    new StubUserContext() as any,
  );
}

async function testRunningBalances() {
  const service = createService();
  const compute = (service as any).computeRunningBalances.bind(service);

  const ledger = [
    {
      id: 'tx-initial',
      amount: 200,
      date: new Date(Date.UTC(2025, 0, 1)),
      createdAt: new Date(Date.UTC(2025, 0, 1, 0, 0, 1)),
      transactionType: TransactionType.INITIAL,
    },
    {
      id: 'tx-income',
      amount: 500,
      date: new Date(Date.UTC(2025, 0, 2)),
      createdAt: new Date(Date.UTC(2025, 0, 2)),
      transactionType: TransactionType.NONE,
    },
    {
      id: 'tx-expense',
      amount: -100,
      date: new Date(Date.UTC(2025, 0, 3)),
      createdAt: new Date(Date.UTC(2025, 0, 3)),
      transactionType: TransactionType.NONE,
    },
  ];

  const result: Map<string, number> = compute(ledger, 100);
  assert.equal(result.get('tx-initial'), 200);
  assert.equal(result.get('tx-income'), 700);
  assert.equal(result.get('tx-expense'), 600);
}

async function testMonthHelpers() {
  const service = createService();
  const getMonthStart = (service as any).getMonthStart.bind(service);
  const getNextMonth = (service as any).getNextMonth.bind(service);
  const getPreviousMonth = (service as any).getPreviousMonth.bind(service);
  const formatMonthKey = (service as any).formatMonthKey.bind(service);

  const reference = new Date(Date.UTC(2025, 4, 15));

  const start = getMonthStart(reference);
  assert.equal(start.getUTCDate(), 1);
  assert.equal(start.getUTCMonth(), 4);

  const next = getNextMonth(reference);
  assert.equal(next.getUTCMonth(), 5);

  const previous = getPreviousMonth(reference);
  assert.equal(previous.getUTCMonth(), 3);

  const key = formatMonthKey(reference);
  assert.equal(key, '2025-05');
}

(async () => {
  await testRunningBalances();
  await testMonthHelpers();
  console.log('Transactions utilities tests passed ✓');
})();
