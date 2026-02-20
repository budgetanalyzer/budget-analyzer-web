// src/types/view.ts
import { Transaction } from '@/types/transaction';

/**
 * Filter criteria for a saved view
 */
export interface ViewCriteriaApi {
  startDate?: string;
  endDate?: string;
  accountIds?: string[];
  bankNames?: string[];
  currencyIsoCodes?: string[];
  minAmount?: number;
  maxAmount?: number;
  searchText?: string;
}

/**
 * Saved view response from API
 */
export interface SavedView {
  id: string;
  name: string;
  criteria: ViewCriteriaApi;
  openEnded: boolean;
  pinnedCount: number;
  excludedCount: number;
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a new saved view
 */
export interface CreateSavedViewRequest {
  name: string;
  criteria: ViewCriteriaApi;
  openEnded?: boolean;
}

/**
 * Request to update a saved view
 */
export interface UpdateSavedViewRequest {
  name?: string;
  criteria?: ViewCriteriaApi;
  openEnded?: boolean;
}

/**
 * Response from GET /v1/views/{id}/transactions
 * Contains transaction IDs grouped by membership type
 */
export interface ViewMembershipResponse {
  matched: number[];
  pinned: number[];
  excluded: number[];
}

/**
 * How a transaction is included in a view
 */
export type ViewMembershipType = 'MATCHED' | 'PINNED';

/**
 * Transaction with view membership information
 */
export interface ViewTransaction extends Transaction {
  membershipType: ViewMembershipType;
}
