// src/api/viewApi.ts
import { apiClient } from '@/api/client';
import {
  SavedView,
  CreateSavedViewRequest,
  UpdateSavedViewRequest,
  ViewMembershipResponse,
} from '@/types/view';

export const viewApi = {
  /**
   * Get all saved views for the current user
   */
  listViews: async (): Promise<SavedView[]> => {
    const response = await apiClient.get<SavedView[]>('/v1/views');
    return response.data;
  },

  /**
   * Get a saved view by ID
   */
  getView: async (id: string): Promise<SavedView> => {
    const response = await apiClient.get<SavedView>(`/v1/views/${id}`);
    return response.data;
  },

  /**
   * Create a new saved view
   */
  createView: async (request: CreateSavedViewRequest): Promise<SavedView> => {
    const response = await apiClient.post<SavedView>('/v1/views', request);
    return response.data;
  },

  /**
   * Update a saved view
   */
  updateView: async (id: string, request: UpdateSavedViewRequest): Promise<SavedView> => {
    const response = await apiClient.put<SavedView>(`/v1/views/${id}`, request);
    return response.data;
  },

  /**
   * Delete a saved view
   */
  deleteView: async (id: string): Promise<void> => {
    await apiClient.delete(`/v1/views/${id}`);
  },

  /**
   * Get transaction membership for this view
   * Returns IDs grouped by membership type (matched, pinned, excluded)
   */
  getViewTransactions: async (id: string): Promise<ViewMembershipResponse> => {
    const response = await apiClient.get<ViewMembershipResponse>(`/v1/views/${id}/transactions`);
    return response.data;
  },

  /**
   * Pin a transaction to the view
   */
  pinTransaction: async (viewId: string, txnId: number): Promise<SavedView> => {
    const response = await apiClient.post<SavedView>(`/v1/views/${viewId}/pin/${txnId}`);
    return response.data;
  },

  /**
   * Unpin a transaction from the view
   */
  unpinTransaction: async (viewId: string, txnId: number): Promise<SavedView> => {
    const response = await apiClient.delete<SavedView>(`/v1/views/${viewId}/pin/${txnId}`);
    return response.data;
  },

  /**
   * Exclude a transaction from the view
   */
  excludeTransaction: async (viewId: string, txnId: number): Promise<SavedView> => {
    const response = await apiClient.post<SavedView>(`/v1/views/${viewId}/exclude/${txnId}`);
    return response.data;
  },

  /**
   * Remove exclusion from a transaction
   */
  unexcludeTransaction: async (viewId: string, txnId: number): Promise<SavedView> => {
    const response = await apiClient.delete<SavedView>(`/v1/views/${viewId}/exclude/${txnId}`);
    return response.data;
  },
};
