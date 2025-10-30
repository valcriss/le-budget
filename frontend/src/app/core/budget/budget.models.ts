import { Category } from '../categories/categories.models';

export interface BudgetCategory {
  id: string;
  groupId: string;
  categoryId: string;
  category: Category;
  assigned: number;
  activity: number;
  available: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetCategoryGroup {
  id: string;
  monthId: string;
  categoryId: string;
  category: Category;
  assigned: number;
  activity: number;
  available: number;
  items: BudgetCategory[];
}

export interface BudgetMonth {
  id: string;
  month: string;
  availableCarryover: number;
  income: number;
  totalAssigned: number;
  totalActivity: number;
  totalAvailable: number;
  groups: BudgetCategoryGroup[];
  createdAt: string;
  updatedAt: string;
}
