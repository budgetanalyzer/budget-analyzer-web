// src/api/viewApi.ts
import { apiClient } from '@/api/client';
import { assertArrayResponse } from '@/api/collectionResponse';
import { ApiError } from '@/types/apiError';
import {
  CloneSavedViewRequest,
  SavedViewMetadata,
  CreateSavedViewRequest,
  UpdateSavedViewRequest,
  UpdateSavedViewTransactionsRequest,
  ViewMembershipResponse,
} from '@/types/view';

function invalidViewRequest(message: string): ApiError {
  return new ApiError(400, { type: 'VALIDATION_ERROR', message });
}

function assertPositiveTransactionIds(transactionIds: number[], field: string): void {
  if (transactionIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw invalidViewRequest(`${field} must contain only positive integer transaction IDs.`);
  }
}

function validateCreateRequest(request: CreateSavedViewRequest): void {
  assertPositiveTransactionIds(request.transactionIds, 'transactionIds');
}

function validateMembershipDelta(request: UpdateSavedViewTransactionsRequest): void {
  const { addTransactionIds, removeTransactionIds } = request;

  assertPositiveTransactionIds(addTransactionIds, 'addTransactionIds');
  assertPositiveTransactionIds(removeTransactionIds, 'removeTransactionIds');

  if (addTransactionIds.length === 0 && removeTransactionIds.length === 0) {
    throw invalidViewRequest('A membership delta must add or remove at least one transaction ID.');
  }

  const addedIds = new Set(addTransactionIds);
  if (removeTransactionIds.some((id) => addedIds.has(id))) {
    throw invalidViewRequest('A transaction ID cannot be added and removed in the same delta.');
  }
}

export const viewApi = {
  /**
   * Get all saved views for the current user
   */
  listViews: async (): Promise<SavedViewMetadata[]> => {
    const response = await apiClient.get<unknown>('/v1/views');
    return assertArrayResponse<SavedViewMetadata>(response.data);
  },

  /**
   * Get a saved view by ID
   */
  getView: async (id: string): Promise<SavedViewMetadata> => {
    const response = await apiClient.get<SavedViewMetadata>(`/v1/views/${id}`);
    return response.data;
  },

  /**
   * Create a new saved view
   */
  createView: async (request: CreateSavedViewRequest): Promise<SavedViewMetadata> => {
    validateCreateRequest(request);
    const response = await apiClient.post<SavedViewMetadata>('/v1/views', {
      name: request.name,
      transactionIds: request.transactionIds,
    });
    return response.data;
  },

  /**
   * Clone a static saved view under a new name
   */
  cloneView: async (
    sourceViewId: string,
    request: CloneSavedViewRequest,
  ): Promise<SavedViewMetadata> => {
    const response = await apiClient.post<SavedViewMetadata>(`/v1/views/${sourceViewId}/clone`, {
      name: request.name,
    });
    return response.data;
  },

  /**
   * Rename a static saved view
   */
  updateView: async (id: string, request: UpdateSavedViewRequest): Promise<SavedViewMetadata> => {
    const response = await apiClient.patch<SavedViewMetadata>(`/v1/views/${id}`, {
      name: request.name,
    });
    return response.data;
  },

  /**
   * Delete a saved view
   */
  deleteView: async (id: string): Promise<void> => {
    await apiClient.delete(`/v1/views/${id}`);
  },

  /**
   * Get complete, deterministically ordered transaction membership for this view.
   */
  getViewTransactions: async (id: string): Promise<ViewMembershipResponse> => {
    const response = await apiClient.get<ViewMembershipResponse>(`/v1/views/${id}/transactions`);
    return response.data;
  },

  /**
   * Apply an atomic membership delta. A successful response has no body.
   */
  updateViewTransactions: async (
    id: string,
    request: UpdateSavedViewTransactionsRequest,
  ): Promise<void> => {
    validateMembershipDelta(request);
    await apiClient.patch(`/v1/views/${id}/transactions`, {
      addTransactionIds: request.addTransactionIds,
      removeTransactionIds: request.removeTransactionIds,
    });
  },
};
