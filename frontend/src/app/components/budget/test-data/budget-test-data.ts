// Test data aligning with the hierarchical budget API structure.

export interface TestCategory {
  id: string;
  name: string;
  parentCategoryId: string | null;
  sortOrder: number;
}

export interface BudgetCategoryItemData {
  categoryId: string;
  category: TestCategory;
  assigned?: number | string;
  activity?: number | string;
  available?: number | string;
}

export interface BudgetCategoryGroupData {
  categoryId: string;
  category: TestCategory;
  assigned?: number | string;
  activity?: number | string;
  available?: number | string;
  items: BudgetCategoryItemData[];
}

const createCategory = (
  id: string,
  name: string,
  parentCategoryId: string | null,
  sortOrder: number,
): TestCategory => ({
  id,
  name,
  parentCategoryId,
  sortOrder,
});

const parents = {
  revenus: createCategory('cat-parent-revenus', 'Revenus', null, 0),
  logement: createCategory('cat-parent-logement', 'Logement', null, 1),
  alimentation: createCategory('cat-parent-alimentation', 'Alimentation', null, 2),
  transport: createCategory('cat-parent-transport', 'Transport', null, 3),
  loisirs: createCategory('cat-parent-loisirs', 'Loisirs', null, 4),
  divers: createCategory('cat-parent-divers', 'Divers', null, 5),
};

const children = {
  salaire: createCategory('cat-child-salaire', 'Salaire', parents.revenus.id, 0),
  loyer: createCategory('cat-child-loyer', 'Loyer', parents.logement.id, 0),
  assuranceHabitation: createCategory(
    'cat-child-assurance-habitation',
    'Assurance habitation',
    parents.logement.id,
    1,
  ),
  electricite: createCategory('cat-child-electricite', 'Électricité', parents.logement.id, 2),
  gaz: createCategory('cat-child-gaz', 'Gaz', parents.logement.id, 3),
  supermarche: createCategory('cat-child-supermarche', 'Supermarché', parents.alimentation.id, 0),
  restaurants: createCategory('cat-child-restaurants', 'Restaurants', parents.alimentation.id, 1),
  cafes: createCategory('cat-child-cafes', 'Cafés & Snacks', parents.alimentation.id, 2),
  essence: createCategory('cat-child-essence', 'Essence', parents.transport.id, 0),
  abonnementTransport: createCategory(
    'cat-child-abonnement-transport',
    'Abonnement transport',
    parents.transport.id,
    1,
  ),
  entretien: createCategory('cat-child-entretien', 'Entretien', parents.transport.id, 2),
  cinema: createCategory('cat-child-cinema', 'Cinéma', parents.loisirs.id, 0),
  abonnements: createCategory('cat-child-abonnements', 'Abonnements', parents.loisirs.id, 1),
  voyages: createCategory('cat-child-voyages', 'Voyages', parents.loisirs.id, 2),
  remboursements: createCategory('cat-child-remboursements', 'Remboursements', parents.divers.id, 0),
};

export const BUDGET_TEST_DATA: BudgetCategoryGroupData[] = [
  {
    categoryId: parents.logement.id,
    category: parents.logement,
    assigned: 1200,
    activity: -1150,
    available: 50,
    items: [
      { categoryId: children.loyer.id, category: children.loyer, assigned: 900, activity: -900, available: 0 },
      {
        categoryId: children.assuranceHabitation.id,
        category: children.assuranceHabitation,
        assigned: 50,
        activity: -45,
        available: 5,
      },
      {
        categoryId: children.electricite.id,
        category: children.electricite,
        assigned: 100,
        activity: -90,
        available: 10,
      },
      { categoryId: children.gaz.id, category: children.gaz, assigned: 50, activity: -40, available: 10 },
    ],
  },
  {
    categoryId: parents.alimentation.id,
    category: parents.alimentation,
    assigned: 600,
    activity: -420,
    available: 180,
    items: [
      {
        categoryId: children.supermarche.id,
        category: children.supermarche,
        assigned: 350,
        activity: -300,
        available: 50,
      },
      {
        categoryId: children.restaurants.id,
        category: children.restaurants,
        assigned: 150,
        activity: -80,
        available: 70,
      },
      { categoryId: children.cafes.id, category: children.cafes, assigned: 100, activity: -40, available: 60 },
    ],
  },
  {
    categoryId: parents.transport.id,
    category: parents.transport,
    assigned: 220,
    activity: -200,
    available: 20,
    items: [
      { categoryId: children.essence.id, category: children.essence, assigned: 100, activity: -90, available: 10 },
      {
        categoryId: children.abonnementTransport.id,
        category: children.abonnementTransport,
        assigned: 80,
        activity: -80,
        available: 0,
      },
      { categoryId: children.entretien.id, category: children.entretien, assigned: 40, activity: -30, available: 10 },
    ],
  },
  {
    categoryId: parents.loisirs.id,
    category: parents.loisirs,
    assigned: 150,
    activity: -60,
    available: 90,
    items: [
      { categoryId: children.cinema.id, category: children.cinema, assigned: 30, activity: -10, available: 20 },
      {
        categoryId: children.abonnements.id,
        category: children.abonnements,
        assigned: 50,
        activity: -30,
        available: 20,
      },
      { categoryId: children.voyages.id, category: children.voyages, assigned: 70, activity: -20, available: 50 },
    ],
  },
  {
    categoryId: parents.divers.id,
    category: parents.divers,
    assigned: 150,
    activity: 150,
    available: 300,
    items: [
      {
        categoryId: children.remboursements.id,
        category: children.remboursements,
        assigned: 0,
        activity: 150,
        available: 150,
      },
    ],
  },
  {
    categoryId: parents.revenus.id,
    category: parents.revenus,
    assigned: 0,
    activity: 2500,
    available: 2500,
    items: [
      { categoryId: children.salaire.id, category: children.salaire, assigned: 0, activity: 2500, available: 2500 },
    ],
  },
];

export function generateRandomBudgetGroups(count = 5, maxItems = 10): BudgetCategoryGroupData[] {
  const groups: BudgetCategoryGroupData[] = [];
  for (let i = 0; i < count; i++) {
    const parent = createCategory(`rand-parent-${i}`, `Groupe ${i + 1}`, null, i);
    const group: BudgetCategoryGroupData = {
      categoryId: parent.id,
      category: parent,
      items: [],
      assigned: 0,
      activity: 0,
      available: 0,
    };

    const n = Math.floor(Math.random() * (maxItems + 1));
    for (let j = 0; j < n; j++) {
      const assigned = Math.round(Math.random() * 500);
      const activity = -Math.round(Math.random() * assigned);
      const child = createCategory(`rand-child-${i}-${j}`, `Catégorie ${i + 1}.${j + 1}`, parent.id, j);
      const item: BudgetCategoryItemData = {
        categoryId: child.id,
        category: child,
        assigned,
        activity,
        available: assigned + activity,
      };
      group.items.push(item);
    }

    group.assigned = group.items.reduce((sum, item) => sum + Number(item.assigned ?? 0), 0);
    group.activity = group.items.reduce((sum, item) => sum + Number(item.activity ?? 0), 0);
    group.available = Number(group.assigned ?? 0) + Number(group.activity ?? 0);

    groups.push(group);
  }
  return groups;
}
