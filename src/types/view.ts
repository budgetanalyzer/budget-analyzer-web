// src/types/view.ts
/**
 * Static saved-view metadata from the current API.
 */
export interface SavedViewMetadata {
  id: string;
  name: string;
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a static saved view.
 */
export interface CreateSavedViewRequest {
  name: string;
  transactionIds: number[];
}

/**
 * Request to clone a static saved view.
 */
export interface CloneSavedViewRequest {
  name: string;
}

/**
 * Request to rename a static saved view.
 */
export interface UpdateSavedViewRequest {
  name: string;
}

/**
 * Complete, deterministically ordered static saved-view membership.
 */
export interface ViewMembershipResponse {
  transactionIds: number[];
}

/**
 * Atomic static saved-view membership additions and removals.
 */
export interface UpdateSavedViewTransactionsRequest {
  addTransactionIds: number[];
  removeTransactionIds: number[];
}
