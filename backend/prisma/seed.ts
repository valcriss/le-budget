import { AccountType, CategoryKind, PrismaClient } from '@prisma/client';
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

  const categoriesSeed = [
    { name: 'Salaire', kind: CategoryKind.INCOME },
    { name: 'Logement', kind: CategoryKind.EXPENSE },
    { name: 'Alimentation', kind: CategoryKind.EXPENSE },
    { name: 'Loisirs', kind: CategoryKind.EXPENSE },
    { name: 'Transports', kind: CategoryKind.EXPENSE },
    { name: 'Catégorie', kind: CategoryKind.EXPENSE },
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoriesSeed) {
    const created = await prisma.category.create({
      data: {
        userId: demoUser.id,
        name: cat.name,
        kind: cat.kind,
      },
    });
    categories[cat.name] = created.id;
  }

  const accountsSeed = [
    {
      name: 'Compte CIC',
      type: AccountType.CHECKING,
      institution: 'CIC',
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
          categoryName: 'Logement',
        },
        {
          date: '2025-10-07',
          label: 'Supermarché',
          amount: -120.45,
          categoryName: 'Alimentation',
        },
        {
          date: '2025-10-11',
          label: 'Essence',
          amount: -60,
          categoryName: 'Transports',
        },
        {
          date: '2025-10-18',
          label: 'Sortie cinéma',
          amount: -35,
          categoryName: 'Loisirs',
        },
        {
          date: '2025-10-20',
          label: 'Remboursement Trésor Public',
          amount: 150,
          categoryName: 'Catégorie',
        },
      ],
    },
    {
      name: 'Compte Crédit Agricole',
      type: AccountType.SAVINGS,
      institution: 'Crédit Agricole',
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
        institution: accountSeed.institution,
        currency: accountSeed.currency,
        initialBalance: accountSeed.initialBalance,
        currentBalance: accountSeed.initialBalance,
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
      name: 'Logement',
      categories: [
        { name: 'Loyer', assigned: 900, activity: -900, available: 0 },
        { name: 'Assurance habitation', assigned: 50, activity: -45, available: 5 },
        { name: 'Électricité', assigned: 100, activity: -90, available: 10 },
        { name: 'Gaz', assigned: 50, activity: -40, available: 10 },
      ],
    },
    {
      name: 'Alimentation',
      categories: [
        { name: 'Supermarché', assigned: 350, activity: -300, available: 50 },
        { name: 'Restaurants', assigned: 150, activity: -80, available: 70 },
        { name: 'Cafés & Snacks', assigned: 100, activity: -40, available: 60 },
      ],
    },
    {
      name: 'Transport',
      categories: [
        { name: 'Carburant', assigned: 100, activity: -90, available: 10 },
        { name: 'Abonnement transport', assigned: 80, activity: -80, available: 0 },
        { name: 'Entretien', assigned: 40, activity: -30, available: 10 },
      ],
    },
    {
      name: 'Loisirs',
      categories: [
        { name: 'Cinéma', assigned: 30, activity: -10, available: 20 },
        { name: 'Abonnements', assigned: 50, activity: -30, available: 20 },
        { name: 'Voyages', assigned: 70, activity: -20, available: 50 },
      ],
    },
    {
      name: 'Épargne / Divers',
      categories: [],
    },
  ];

  for (const [groupIndex, groupSeed] of budgetGroupsSeed.entries()) {
    const group = await prisma.budgetCategoryGroup.create({
      data: {
        monthId: budgetMonth.id,
        name: groupSeed.name,
        sortOrder: groupIndex,
      },
    });

    for (const [categoryIndex, categorySeed] of groupSeed.categories.entries()) {
      await prisma.budgetCategory.create({
        data: {
          groupId: group.id,
          name: categorySeed.name,
          assigned: categorySeed.assigned,
          activity: categorySeed.activity,
          available: categorySeed.available,
          sortOrder: categoryIndex,
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
