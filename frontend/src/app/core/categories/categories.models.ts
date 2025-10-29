export type CategoryKind = 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'GOAL';

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  parentCategoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryPayload {
  name: string;
  kind: CategoryKind;
  parentCategoryId?: string | null;
}

export interface UpdateCategoryPayload {
  name?: string;
  kind?: CategoryKind;
  parentCategoryId?: string | null;
}
