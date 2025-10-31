export type TransactionStatus = 'NONE' | 'POINTED' | 'RECONCILED';

export type TransactionType = 'NONE' | 'INITIAL' | 'TRANSFERT';

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  label: string;
  categoryId: string | null;
  categoryName: string | null;
  amount: number;
  balance: number;
  status: TransactionStatus;
  transactionType: TransactionType;
  linkedTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionsListResponse {
  items: Transaction[];
  meta: {
    total: number;
    skip: number;
    take: number;
  };
}

export interface TransactionsQuery {
  skip?: number;
  take?: number;
  from?: string;
  to?: string;
  search?: string;
  status?: TransactionStatus;
  transactionType?: TransactionType;
}

export type UpdateTransactionPayload = Partial<{
  date: string;
  label: string;
  amount: number;
  status: TransactionStatus;
  transactionType: TransactionType;
  categoryId: string | null;
  linkedTransactionId: string | null;
}>;

export interface CreateTransactionPayload {
  date: string;
  label: string;
  amount: number;
  status?: TransactionStatus;
  transactionType?: TransactionType;
  categoryId?: string | null;
  linkedTransactionId?: string | null;
}
