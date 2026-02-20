// src/hooks/useViews.ts
import { useMemo } from 'react';
import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import {
  SavedView,
  ViewTransaction,
  ViewMembershipResponse,
  CreateSavedViewRequest,
  UpdateSavedViewRequest,
} from '@/types/view';
import { Transaction } from '@/types/transaction';
import { viewApi } from '@/api/viewApi';
import { transactionApi } from '@/api/transactionApi';
import { ApiError } from '@/types/apiError';
import { reconcileViewTransactions } from '@/utils/reconcileViewTransactions';

/**
 * Query key factory for views
 */
export const viewKeys = {
  all: ['views'] as const,
  lists: () => [...viewKeys.all, 'list'] as const,
  list: () => viewKeys.lists(),
  details: () => [...viewKeys.all, 'detail'] as const,
  detail: (id: string) => [...viewKeys.details(), id] as const,
  transactions: (id: string) => [...viewKeys.all, 'transactions', id] as const,
};

/**
 * Hook to fetch all saved views
 */
export const useViews = (): UseQueryResult<SavedView[], ApiError> => {
  return useQuery<SavedView[], ApiError>({
    queryKey: viewKeys.list(),
    queryFn: () => viewApi.listViews(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
};

/**
 * Hook to fetch a single saved view by ID
 */
export const useView = (id: string): UseQueryResult<SavedView, ApiError> => {
  return useQuery<SavedView, ApiError>({
    queryKey: viewKeys.detail(id),
    queryFn: () => viewApi.getView(id),
    staleTime: 1000 * 60 * 5,
    retry: 1,
    enabled: !!id,
  });
};

/**
 * Hook to fetch transactions for a saved view
 *
 * This hook:
 * 1. Fetches view membership (transaction IDs grouped by type)
 * 2. Reconciles IDs with the main transactions cache
 * 3. Fetches any missing transactions individually
 * 4. Returns ViewTransaction[] with membershipType field added
 *
 * The hook depends on the main transactions cache being available.
 * Loading state is true if either membership or transactions are loading.
 */
export const useViewTransactions = (id: string): UseQueryResult<ViewTransaction[], ApiError> => {
  const queryClient = useQueryClient();

  // Step 1: Fetch view membership (transaction IDs)
  const membershipQuery = useQuery<ViewMembershipResponse, ApiError>({
    queryKey: viewKeys.transactions(id),
    queryFn: () => viewApi.getViewTransactions(id),
    staleTime: 1000 * 60 * 5,
    retry: 1,
    enabled: !!id,
  });

  // Step 2: Get cached transactions
  const cachedTransactions = queryClient.getQueryData<Transaction[]>(['transactions']);

  // Step 3: Reconcile membership IDs with cached transactions
  const reconciliation = useMemo(() => {
    if (!membershipQuery.data) {
      return { viewTransactions: [], missingIds: [] };
    }
    return reconcileViewTransactions(membershipQuery.data, cachedTransactions);
  }, [membershipQuery.data, cachedTransactions]);

  // Step 4: Fetch missing transactions individually using useQueries
  const missingTransactionsQueries = useQueries({
    queries: reconciliation.missingIds.map((txnId) => ({
      queryKey: ['transaction', txnId],
      queryFn: () => transactionApi.getTransaction(txnId),
      staleTime: 1000 * 60 * 5,
      retry: 1,
      enabled: !!txnId,
    })),
    combine: (results) => {
      const fetchedTransactions: Transaction[] = [];
      results.forEach((result) => {
        if (result.data) {
          fetchedTransactions.push(result.data);
        }
      });

      return {
        data: fetchedTransactions,
        isLoading: results.some((result) => result.isLoading),
        error: results.find((result) => result.error)?.error as ApiError | undefined,
      };
    },
  });

  // Step 5: Merge reconciled transactions with fetched missing transactions
  const finalTransactions = useMemo<ViewTransaction[]>(() => {
    if (!membershipQuery.data) return [];

    const merged = [...reconciliation.viewTransactions];

    // Add membership type to fetched transactions
    const membershipMap = new Map<number, 'MATCHED' | 'PINNED'>();
    membershipQuery.data.matched.forEach((transactionId) =>
      membershipMap.set(transactionId, 'MATCHED'),
    );
    membershipQuery.data.pinned.forEach((transactionId) =>
      membershipMap.set(transactionId, 'PINNED'),
    );

    missingTransactionsQueries.data.forEach((txn) => {
      const membershipType = membershipMap.get(txn.id);
      if (membershipType) {
        merged.push({
          ...txn,
          membershipType,
        });
      }
    });

    return merged;
  }, [membershipQuery.data, reconciliation.viewTransactions, missingTransactionsQueries.data]);

  // Step 6: Combine loading and error states
  const isLoading = membershipQuery.isLoading || missingTransactionsQueries.isLoading;
  const error = membershipQuery.error || missingTransactionsQueries.error;

  // Return in UseQueryResult format for compatibility
  // Use 'as unknown as' to handle the type transformation from membership query to transaction array result
  return {
    ...membershipQuery,
    data: finalTransactions,
    isLoading,
    isError: !!error,
    error: error || null,
    isSuccess: membershipQuery.isSuccess && !missingTransactionsQueries.isLoading && !error,
    isFetching: membershipQuery.isFetching || missingTransactionsQueries.isLoading,
  } as unknown as UseQueryResult<ViewTransaction[], ApiError>;
};

/**
 * Hook to create a new saved view
 */
export const useCreateView = () => {
  const queryClient = useQueryClient();

  return useMutation<SavedView, ApiError, CreateSavedViewRequest>({
    mutationFn: (request: CreateSavedViewRequest) => viewApi.createView(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewKeys.list() });
    },
  });
};

/**
 * Hook to update a saved view
 */
export const useUpdateView = () => {
  const queryClient = useQueryClient();

  return useMutation<SavedView, ApiError, { id: string; request: UpdateSavedViewRequest }>({
    mutationFn: ({ id, request }) => viewApi.updateView(id, request),
    onSuccess: (updatedView) => {
      queryClient.invalidateQueries({ queryKey: viewKeys.list() });
      queryClient.invalidateQueries({ queryKey: viewKeys.detail(updatedView.id) });
    },
  });
};

/**
 * Hook to delete a saved view
 */
export const useDeleteView = () => {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, string>({
    mutationFn: (id: string) => viewApi.deleteView(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewKeys.list() });
    },
  });
};

/**
 * Hook to pin a transaction to a view
 */
export const usePinTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation<SavedView, ApiError, { viewId: string; txnId: number }>({
    mutationFn: ({ viewId, txnId }) => viewApi.pinTransaction(viewId, txnId),
    onSuccess: (updatedView) => {
      queryClient.invalidateQueries({ queryKey: viewKeys.detail(updatedView.id) });
      queryClient.invalidateQueries({ queryKey: viewKeys.transactions(updatedView.id) });
      queryClient.invalidateQueries({ queryKey: viewKeys.list() });
    },
  });
};

/**
 * Hook to unpin a transaction from a view
 */
export const useUnpinTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation<SavedView, ApiError, { viewId: string; txnId: number }>({
    mutationFn: ({ viewId, txnId }) => viewApi.unpinTransaction(viewId, txnId),
    onSuccess: (updatedView) => {
      queryClient.invalidateQueries({ queryKey: viewKeys.detail(updatedView.id) });
      queryClient.invalidateQueries({ queryKey: viewKeys.transactions(updatedView.id) });
      queryClient.invalidateQueries({ queryKey: viewKeys.list() });
    },
  });
};

/**
 * Hook to exclude a transaction from a view
 */
export const useExcludeTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation<SavedView, ApiError, { viewId: string; txnId: number }>({
    mutationFn: ({ viewId, txnId }) => viewApi.excludeTransaction(viewId, txnId),
    onSuccess: (updatedView) => {
      queryClient.invalidateQueries({ queryKey: viewKeys.detail(updatedView.id) });
      queryClient.invalidateQueries({ queryKey: viewKeys.transactions(updatedView.id) });
      queryClient.invalidateQueries({ queryKey: viewKeys.list() });
    },
  });
};

/**
 * Hook to remove exclusion from a transaction
 */
export const useUnexcludeTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation<SavedView, ApiError, { viewId: string; txnId: number }>({
    mutationFn: ({ viewId, txnId }) => viewApi.unexcludeTransaction(viewId, txnId),
    onSuccess: (updatedView) => {
      queryClient.invalidateQueries({ queryKey: viewKeys.detail(updatedView.id) });
      queryClient.invalidateQueries({ queryKey: viewKeys.transactions(updatedView.id) });
      queryClient.invalidateQueries({ queryKey: viewKeys.list() });
    },
  });
};
