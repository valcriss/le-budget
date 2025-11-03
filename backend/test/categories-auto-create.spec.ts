import { strict as assert } from 'assert';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { CategoriesService } from '../src/modules/categories/categories.service';
import { CategoryKind } from '@prisma/client';

// Minimal mock implementations for dependencies
class MockEvents { emit() { /* noop */ } }
class MockUserContext { constructor(private userId: string) {} getUserId() { return this.userId; } }
class InMemoryPrisma {
  account: any;
  userSettings: any;
  category: any;
  transaction: any;
  constructor() {
    const accounts: any[] = [];
    const userSettings: any[] = [];
    const categories: any[] = [];
    const transactions: any[] = [];

    this.userSettings = {
      upsert: async ({ where, create }: any) => {
        let s = userSettings.find((u) => u.userId === where.userId);
        if (!s) { s = { userId: create.userId, currency: 'EUR' }; userSettings.push(s); }
        return { currency: s.currency };
      },
    };

    this.account = {
      create: async ({ data }: any) => { const acc = { ...data, id: `acc-${accounts.length+1}` }; accounts.push(acc); return acc; },
      findFirst: async ({ where }: any) => accounts.find((a) => a.id === where.id && a.userId === where.userId) || null,
      update: async ({ where, data }: any) => { const acc = accounts.find((a) => a.id === where.id); Object.assign(acc, data); return acc; },
    };

    this.category = {
      findFirst: async ({ where, select }: any) => {
        const found = categories.find((c) => c.userId === where.userId && c.kind === where.kind);
        if (!found) return null;
        if (select) { const proj: any = {}; if (select.id) proj.id = found.id; return proj; }
        return found;
      },
      aggregate: async ({ where }: any) => {
        const filtered = categories.filter((c) => c.userId === where.userId && c.parentCategoryId === where.parentCategoryId);
        const max = filtered.reduce((m, c) => c.sortOrder > m ? c.sortOrder : m, -1);
        return { _max: { sortOrder: max === -1 ? null : max } };
      },
      create: async ({ data }: any) => { const cat = { ...data, id: `cat-${categories.length+1}` }; categories.push(cat); return cat; },
      findMany: async ({ where }: any) => categories.filter((c) => c.userId === where.userId),
    };

    this.transaction = { create: async ({ data }: any) => { transactions.push({ ...data, id: `tx-${transactions.length+1}` }); } };
  }
}

async function testAutoCategoriesCreation() {
  const prisma: any = new InMemoryPrisma();
  const userId = 'user-auto';
  const accountsService = new AccountsService(prisma, new MockEvents() as any, { createInitialTransactionForAccount: async () => undefined } as any, new MockUserContext(userId) as any);

  await accountsService.create({ name: 'Compte courant', initialBalance: 0 } as any);

  // fetch categories
  const allCategories = await prisma.category.findMany({ where: { userId } });
  const names = allCategories.map((c: any) => c.name);
  assert(names.includes('Solde initial'), 'La catégorie "Solde initial" devrait être créée');
  assert(names.includes('Revenus du mois'), 'La catégorie "Revenus du mois" devrait être créée');
  assert(names.includes('Revenus du mois suivant'), 'La catégorie "Revenus du mois suivant" devrait être créée');
}

(async () => {
  await testAutoCategoriesCreation();
  console.log('Categories auto-create tests passed ✓');
})();
