// src/types/adminTransaction.ts
import type { TransactionType } from '@/types/transaction';

export interface AdminTransaction {
  id: number;
  ownerId: string; // opaque IdP subject (e.g. "usr_test123")
  accountId: string;
  bankName: string;
  date: string; // YYYY-MM-DD
  currencyIsoCode: string;
  amount: number;
  type: TransactionType;
  description: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface PageMetadata {
  page: number;
  size: number;
  numberOfElements: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface PagedResponse<T> {
  content: T[];
  metadata: PageMetadata;
}

export interface AdminTransactionFilters {
  ownerId?: string; // exact string match (no email lookup — deferred)
  accountId?: string;
  bankName?: string;
  description?: string;
  type?: TransactionType;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  minAmount?: number;
  maxAmount?: number;
  currencyIsoCode?: string;
}

export interface AdminTransactionsQuery extends AdminTransactionFilters {
  page: number; // 0-based
  size: number;
  sort: string[]; // e.g. ['date,DESC', 'id,DESC']
}
