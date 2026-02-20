// src/types/transaction.ts
export type TransactionType = 'CREDIT' | 'DEBIT';

export interface Transaction {
  id: number;
  accountId: string;
  bankName: string;
  date: string;
  currencyIsoCode: string;
  amount: number;
  type: TransactionType;
  description: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
  deletedAt?: string;
}

export interface TransactionFilter {
  id?: number;
  accountId?: string;
  bankName?: string;
  dateFrom?: string;
  dateTo?: string;
  currencyIsoCode?: string;
  minAmount?: number;
  maxAmount?: number;
  type?: TransactionType;
  description?: string;
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
}

export interface TransactionUpdateRequest {
  description?: string;
  accountId?: string;
}

// Preview import types
export interface PreviewTransaction {
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category?: string;
  bankName: string;
  currencyIsoCode: string;
  accountId?: string;
}

export interface PreviewWarning {
  index: number;
  field: string;
  message: string;
}

export interface PreviewResponse {
  sourceFile: string;
  transactions: PreviewTransaction[];
  warnings: PreviewWarning[];
}

export interface BatchImportRequest {
  transactions: PreviewTransaction[];
}

export interface BatchImportResponse {
  created: number;
  duplicatesSkipped: number;
  transactions: Transaction[];
}
