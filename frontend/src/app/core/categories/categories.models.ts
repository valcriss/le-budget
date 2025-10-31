export type CategoryKind = 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'INITIAL';

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  sortOrder: number;
  parentCategoryId: string | null;
  linkedAccountId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryPayload {
  name: string;
  kind: CategoryKind;
  parentCategoryId?: string | null;
  sortOrder?: number;
}

export interface UpdateCategoryPayload {
  name?: string;
  kind?: CategoryKind;
  parentCategoryId?: string | null;
  sortOrder?: number;
}
