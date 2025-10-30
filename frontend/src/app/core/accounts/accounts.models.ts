export type AccountType =
  | 'CHECKING'
  | 'SAVINGS'
  | 'CREDIT_CARD'
  | 'CASH'
  | 'INVESTMENT'
  | 'OTHER';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  currency: string;
  initialBalance: number;
  currentBalance: number;
  reconciledBalance: number;
  archived: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AccountsTotals {
  currentBalance: number;
  reconciledBalance: number;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  institution?: string | null;
  currency?: string;
  initialBalance?: number;
  reconciledBalance?: number;
  archived?: boolean;
}

export const ACCOUNT_TYPE_OPTIONS: ReadonlyArray<{ value: AccountType; label: string }> = [
  { value: 'CHECKING', label: 'Compte courant' },
  { value: 'SAVINGS', label: 'Compte épargne' },
  { value: 'CREDIT_CARD', label: 'Carte de crédit' },
  { value: 'CASH', label: 'Espèces' },
  { value: 'INVESTMENT', label: 'Investissement' },
  { value: 'OTHER', label: 'Autre' },
];
