// Test data for budget category groups and items
// Each group contains zero or more items. Fields match component @Input() names.

export interface BudgetCategoryItemData {
  label: string;
  assigned?: number | string;
  paid?: number | string;
  available?: number | string;
}

export interface BudgetCategoryGroupData {
  label: string;
  assigned?: number | string;
  paid?: number | string;
  available?: number | string;
  items?: BudgetCategoryItemData[];
}

// Example: ~5 groups, each with 0..10 items (one group intentionally empty)
export const BUDGET_TEST_DATA: BudgetCategoryGroupData[] = [
  {
    label: 'Logement',
    assigned: 1200,
    paid: -1150,
    available: 50,
    items: [
      { label: 'Loyer', assigned: 900, paid: -900, available: 0 },
      { label: 'Assurance habitation', assigned: 50, paid: -45, available: 5 },
      { label: 'Électricité', assigned: 100, paid: -90, available: 10 },
      { label: 'Gaz', assigned: 50, paid: -40, available: 10 },
    ],
  },
  {
    label: 'Alimentation',
    assigned: 600,
    paid: -420,
    available: 180,
    items: [
      { label: 'Supermarché', assigned: 350, paid: -300, available: 50 },
      { label: 'Restaurants', assigned: 150, paid: -80, available: 70 },
      { label: 'Cafés & Snacks', assigned: 100, paid: -40, available: 60 },
    ],
  },
  {
    label: 'Transport',
    assigned: 220,
    paid: -200,
    available: 20,
    items: [
      { label: 'Carburant', assigned: 100, paid: -90, available: 10 },
      { label: 'Abonnement transport', assigned: 80, paid: -80, available: 0 },
      { label: 'Entretien', assigned: 40, paid: -30, available: 10 },
    ],
  },
  {
    label: 'Loisirs',
    assigned: 150,
    paid: -60,
    available: 90,
    items: [
      { label: 'Cinéma', assigned: 30, paid: -10, available: 20 },
      { label: 'Abonnements', assigned: 50, paid: -30, available: 20 },
      { label: 'Voyages', assigned: 70, paid: -20, available: 50 },
    ],
  },
  {
    label: 'Épargne / Divers (vide)',
    assigned: 0,
    paid: 0,
    available: 0,
    items: [], // intentionally empty group
  },
];

// Helper: generate randomized groups (not used by default but useful in tests)
export function generateRandomBudgetGroups(count = 5, maxItems = 10) {
  const groups: BudgetCategoryGroupData[] = [];
  for (let i = 0; i < count; i++) {
    const items: BudgetCategoryItemData[] = [];
    const n = Math.floor(Math.random() * (maxItems + 1));
    let assignedSum = 0;
    let paidSum = 0;
    for (let j = 0; j < n; j++) {
      const assigned = Math.round(Math.random() * 500);
      const paid = -Math.round(Math.random() * assigned);
      assignedSum += assigned;
      paidSum += paid;
      items.push({ label: `Catégorie ${i + 1}.${j + 1}`, assigned, paid, available: assigned + paid });
    }
    groups.push({ label: `Groupe ${i + 1}`, assigned: assignedSum, paid: paidSum, available: assignedSum + paidSum, items });
  }
  return groups;
}
