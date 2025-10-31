import { AccountType, CategoryKind, PrismaClient, Prisma } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const demoEmail = 'demo@lebudget.local';
  const demoPassword = process.env.DEMO_USER_PASSWORD ?? 'demo1234';
  const passwordHash = await hash(demoPassword);
  const demoUser = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {
      passwordHash,
      displayName: 'Demo User',
    },
    create: {
      email: demoEmail,
      passwordHash,
      displayName: 'Demo User',
    },
  });

  console.info(`Seeding data for user ${demoUser.email} (${demoUser.id})`);

  await prisma.$transaction([
    prisma.budgetCategory.deleteMany({ where: { group: { month: { userId: demoUser.id } } } }),
    prisma.budgetCategoryGroup.deleteMany({ where: { month: { userId: demoUser.id } } }),
    prisma.budgetMonth.deleteMany({ where: { userId: demoUser.id } }),
    prisma.transaction.deleteMany({ where: { account: { userId: demoUser.id } } }),
    prisma.account.deleteMany({ where: { userId: demoUser.id } }),
    prisma.category.deleteMany({ where: { userId: demoUser.id } }),
  ]);

  const categoryHierarchy: Array<{
    name: string;
    kind: CategoryKind;
    children?: Array<{ name: string; kind?: CategoryKind }>;
  }> = [
    {
      name: 'Revenus',
      kind: CategoryKind.INCOME,
      children: [{ name: 'Salaire', kind: CategoryKind.INCOME }],
    },
    {
      name: 'Logement',
      kind: CategoryKind.EXPENSE,
      children: [
        { name: 'Loyer' },
        { name: 'Assurance habitation' },
        { name: 'Électricité' },
        { name: 'Gaz' },
      ],
    },
    {
      name: 'Alimentation',
      kind: CategoryKind.EXPENSE,
      children: [
        { name: 'Supermarché' },
        { name: 'Restaurants' },
        { name: 'Cafés & Snacks' },
      ],
    },
    {
      name: 'Transport',
      kind: CategoryKind.EXPENSE,
      children: [
        { name: 'Essence' },
        { name: 'Abonnement transport' },
        { name: 'Entretien' },
      ],
    },
    {
      name: 'Loisirs',
      kind: CategoryKind.EXPENSE,
      children: [
        { name: 'Cinéma' },
        { name: 'Abonnements' },
        { name: 'Voyages' },
      ],
    },
    {
      name: 'Divers',
      kind: CategoryKind.EXPENSE,
      children: [{ name: 'Remboursements' }],
    },
  ];

  const categories: Record<string, string> = {};
  for (const [parentIndex, parent] of categoryHierarchy.entries()) {
    const parentCategory = await prisma.category.create({
      data: {
        userId: demoUser.id,
        name: parent.name,
        kind: parent.kind,
        sortOrder: parentIndex,
      },
    });
    categories[parent.name] = parentCategory.id;

    for (const [childIndex, child] of (parent.children ?? []).entries()) {
      const childCategory = await prisma.category.create({
        data: {
          userId: demoUser.id,
          name: child.name,
          kind: child.kind ?? parent.kind,
          parentCategoryId: parentCategory.id,
          sortOrder: childIndex,
        },
      });
      categories[child.name] = childCategory.id;
    }
  }

  const accountsSeed = [
    {
      name: 'Compte CIC',
      type: AccountType.CHECKING,
      currency: 'EUR',
      initialBalance: 500,
      transactions: [
        {
          date: '2025-10-01',
          label: 'Salaire Octobre',
          amount: 2500,
          categoryName: 'Salaire',
        },
        {
          date: '2025-10-05',
          label: 'Loyer',
          amount: -900,
          categoryName: 'Loyer',
        },
        {
          date: '2025-10-07',
          label: 'Supermarché',
          amount: -120.45,
          categoryName: 'Supermarché',
        },
        {
          date: '2025-10-11',
          label: 'Essence',
          amount: -60,
          categoryName: 'Essence',
        },
        {
          date: '2025-10-18',
          label: 'Sortie cinéma',
          amount: -35,
          categoryName: 'Cinéma',
        },
        {
          date: '2025-10-20',
          label: 'Remboursement Trésor Public',
          amount: 150,
          categoryName: 'Remboursements',
        },
      ],
    },
    {
      name: 'Compte Crédit Agricole',
      type: AccountType.SAVINGS,
      currency: 'EUR',
      initialBalance: 1500,
      transactions: [],
    },
  ];

  for (const accountSeed of accountsSeed) {
    const account = await prisma.account.create({
      data: {
        userId: demoUser.id,
        name: accountSeed.name,
        type: accountSeed.type,
        currency: accountSeed.currency,
        initialBalance: accountSeed.initialBalance,
        currentBalance: accountSeed.initialBalance,
        pointedBalance: accountSeed.initialBalance,
      } as any,
    });

    const { _max } = await prisma.category.aggregate({
      where: { userId: demoUser.id, parentCategoryId: null },
      _max: { sortOrder: true },
    });

    await prisma.category.create({
      data: {
        userId: demoUser.id,
        name: `Virement ${accountSeed.name}`,
        kind: CategoryKind.TRANSFER,
        sortOrder: (_max.sortOrder ?? -1) + 1,
        linkedAccountId: account.id,
      },
    });

    let runningBalance = accountSeed.initialBalance;
    for (const tx of accountSeed.transactions) {
      await prisma.transaction.create({
        data: {
          accountId: account.id,
          date: new Date(tx.date),
          label: tx.label,
          amount: tx.amount,
          categoryId: tx.categoryName ? categories[tx.categoryName] : null,
        },
      });
      runningBalance += tx.amount;
    }

    await prisma.account.update({
      where: { id: account.id },
      data: { currentBalance: runningBalance },
    });
  }

  const budgetMonth = await prisma.budgetMonth.create({
    data: {
      userId: demoUser.id,
      month: new Date('2025-10-01T00:00:00.000Z'),
      availableCarryover: 120,
      income: 3200,
    },
  });

  const budgetGroupsSeed = [
    {
      parent: 'Logement',
      items: [
        { category: 'Loyer', assigned: 900, activity: -900, available: 0 },
        { category: 'Assurance habitation', assigned: 50, activity: -45, available: 5 },
        { category: 'Électricité', assigned: 100, activity: -90, available: 10 },
        { category: 'Gaz', assigned: 50, activity: -40, available: 10 },
      ],
    },
    {
      parent: 'Alimentation',
      items: [
        { category: 'Supermarché', assigned: 350, activity: -300, available: 50 },
        { category: 'Restaurants', assigned: 150, activity: -80, available: 70 },
        { category: 'Cafés & Snacks', assigned: 100, activity: -40, available: 60 },
      ],
    },
    {
      parent: 'Transport',
      items: [
        { category: 'Essence', assigned: 100, activity: -90, available: 10 },
        { category: 'Abonnement transport', assigned: 80, activity: -80, available: 0 },
        { category: 'Entretien', assigned: 40, activity: -30, available: 10 },
      ],
    },
    {
      parent: 'Loisirs',
      items: [
        { category: 'Cinéma', assigned: 30, activity: -10, available: 20 },
        { category: 'Abonnements', assigned: 50, activity: -30, available: 20 },
        { category: 'Voyages', assigned: 70, activity: -20, available: 50 },
      ],
    },
    {
      parent: 'Divers',
      items: [{ category: 'Remboursements', assigned: 0, activity: 150, available: 150 }],
    },
    {
      parent: 'Revenus',
      items: [{ category: 'Salaire', assigned: 2500, activity: 2500, available: 2500 }],
    },
  ];

  for (const groupSeed of budgetGroupsSeed) {
    const parentId = categories[groupSeed.parent];
    if (!parentId) continue;

    const group = await prisma.budgetCategoryGroup.create({
      data: {
        monthId: budgetMonth.id,
        categoryId: parentId,
      },
    });

    for (const categorySeed of groupSeed.items) {
      const categoryId = categories[categorySeed.category];
      if (!categoryId) continue;

      await prisma.budgetCategory.create({
        data: {
          groupId: group.id,
          categoryId,
          assigned: categorySeed.assigned,
          activity: categorySeed.activity,
          available: categorySeed.available,
        },
      });
    }
  }

  console.info('Seed completed successfully.');
  console.info(`Demo credentials -> email: ${demoUser.email} | password: ${demoPassword}`);
}

main()
  .catch(async (err) => {
    console.error('Seeding failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
