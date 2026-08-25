import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { viewApi } from '@/api/viewApi';
import { useTransactions } from '@/hooks/useTransactions';
import { savedViewInvalidationKeys, viewKeys } from '@/queryKeys';
import type { ApiError } from '@/types/apiError';
import type { Transaction } from '@/types/transaction';
import type {
  CreateSavedViewRequest,
  SavedViewMetadata,
  UpdateSavedViewRequest,
  UpdateSavedViewTransactionsRequest,
  ViewMembershipResponse,
} from '@/types/view';
import { reconcileViewTransactions } from '@/utils/reconcileViewTransactions';

const VIEW_STALE_TIME = 1000 * 60 * 5;

function invalidateKeys(
  queryClient: ReturnType<typeof useQueryClient>,
  keys: readonly (readonly unknown[])[],
): void {
  keys.forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey });
  });
}

export const useViews = (): UseQueryResult<SavedViewMetadata[], ApiError> =>
  useQuery<SavedViewMetadata[], ApiError>({
    queryKey: viewKeys.list(),
    queryFn: viewApi.listViews,
    staleTime: VIEW_STALE_TIME,
    retry: 1,
  });

export const useView = (id: string): UseQueryResult<SavedViewMetadata, ApiError> =>
  useQuery<SavedViewMetadata, ApiError>({
    queryKey: viewKeys.detail(id),
    queryFn: () => viewApi.getView(id),
    staleTime: VIEW_STALE_TIME,
    retry: 1,
    enabled: !!id,
  });

export const useViewMembership = (id: string): UseQueryResult<ViewMembershipResponse, ApiError> =>
  useQuery<ViewMembershipResponse, ApiError>({
    queryKey: viewKeys.membership(id),
    queryFn: () => viewApi.getViewTransactions(id),
    staleTime: VIEW_STALE_TIME,
    retry: 1,
    enabled: !!id,
  });

export interface UseViewTransactionsResult {
  data: Transaction[] | undefined;
  allTransactions: Transaction[] | undefined;
  memberTransactionIds: number[];
  missingTransactionIds: number[];
  isLoading: boolean;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

/**
 * Intersect static membership with the complete active transaction snapshot.
 * Missing snapshot rows are reported but never fetched individually.
 */
export const useViewTransactions = (id: string): UseViewTransactionsResult => {
  const membershipQuery = useViewMembership(id);
  const transactionsQuery = useTransactions({ enabled: !!id });

  const reconciliation = useMemo(() => {
    if (!membershipQuery.data || !transactionsQuery.data) {
      return undefined;
    }

    return reconcileViewTransactions(membershipQuery.data, transactionsQuery.data);
  }, [membershipQuery.data, transactionsQuery.data]);

  const refetchMembership = membershipQuery.refetch;
  const refetchTransactions = transactionsQuery.refetch;
  const refetch = useCallback(async () => {
    await Promise.all([refetchMembership(), refetchTransactions()]);
  }, [refetchMembership, refetchTransactions]);

  const error = membershipQuery.error ?? transactionsQuery.error ?? null;

  return {
    data: reconciliation?.transactions,
    allTransactions: transactionsQuery.data,
    memberTransactionIds: membershipQuery.data?.transactionIds ?? [],
    missingTransactionIds: reconciliation?.missingTransactionIds ?? [],
    isLoading: membershipQuery.isLoading || transactionsQuery.isLoading,
    isPending: membershipQuery.isPending || transactionsQuery.isPending,
    isFetching: membershipQuery.isFetching || transactionsQuery.isFetching,
    isError: membershipQuery.isError || transactionsQuery.isError,
    isSuccess: membershipQuery.isSuccess && transactionsQuery.isSuccess,
    error,
    refetch,
  };
};

export const useCreateView = () => {
  const queryClient = useQueryClient();

  return useMutation<SavedViewMetadata, ApiError, CreateSavedViewRequest>({
    mutationFn: viewApi.createView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewKeys.list() });
    },
    onError: (error) => {
      if (error.response.code === 'SAVED_VIEW_MEMBERSHIP_STALE') {
        invalidateKeys(queryClient, savedViewInvalidationKeys.staleCreation());
      }
    },
  });
};

export const useUpdateView = () => {
  const queryClient = useQueryClient();

  return useMutation<SavedViewMetadata, ApiError, { id: string; request: UpdateSavedViewRequest }>({
    mutationFn: ({ id, request }) => viewApi.updateView(id, request),
    onSuccess: (updatedView) => {
      invalidateKeys(queryClient, savedViewInvalidationKeys.rename(updatedView.id));
    },
  });
};

interface UpdateViewTransactionsVariables {
  viewId: string;
  request: UpdateSavedViewTransactionsRequest;
}

/**
 * Build the atomic delta used by every remove-from-view workflow.
 */
export function createRemoveViewTransactionsRequest(
  transactionIds: number[],
): UpdateSavedViewTransactionsRequest {
  const uniquePositiveIds = Array.from(
    new Set(transactionIds.filter((id) => Number.isInteger(id) && id > 0)),
  );

  return {
    addTransactionIds: [],
    removeTransactionIds: uniquePositiveIds,
  };
}

/**
 * Build a deduplicated atomic delta for add-to-view selection.
 */
export function createAddViewTransactionsRequest(
  transactionIds: number[],
): UpdateSavedViewTransactionsRequest {
  const uniquePositiveIds = Array.from(
    new Set(transactionIds.filter((id) => Number.isInteger(id) && id > 0)),
  );

  return {
    addTransactionIds: uniquePositiveIds,
    removeTransactionIds: [],
  };
}

export const useUpdateViewTransactions = () => {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, UpdateViewTransactionsVariables>({
    mutationFn: ({ viewId, request }) => viewApi.updateViewTransactions(viewId, request),
    onSuccess: (_response, { viewId }) => {
      invalidateKeys(queryClient, savedViewInvalidationKeys.membership(viewId));
    },
    onError: (error, { viewId, request }) => {
      if (
        request.addTransactionIds.length > 0 &&
        error.response.code === 'SAVED_VIEW_MEMBERSHIP_STALE'
      ) {
        invalidateKeys(queryClient, savedViewInvalidationKeys.staleAddition(viewId));
      }
    },
  });
};

export const useDeleteView = () => {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, string>({
    mutationFn: viewApi.deleteView,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewKeys.list() });
    },
  });
};
