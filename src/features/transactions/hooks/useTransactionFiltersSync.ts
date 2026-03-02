// src/features/transactions/hooks/useTransactionFiltersSync.ts
import { useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useAppDispatch } from '@/store/hooks';
import {
  setTransactionTableDateFilter,
  setTransactionTableGlobalFilter,
  setTransactionTableBankNameFilter,
  setTransactionTableAccountIdFilter,
  setTransactionTableTypeFilter,
  setTransactionTableAmountFilter,
} from '@/store/uiSlice';
import { TransactionType } from '@/types/transaction';

/**
 * Custom hook to synchronize transaction filters between URL search params and Redux state
 * URL is the source of truth for filters (enables bookmarkability)
 *
 * @returns Object with handlers for updating filters and checking active state
 */
export function useTransactionFiltersSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useAppDispatch();

  // Sync URL params to Redux on mount and when URL changes
  // URL is the source of truth for filters (for bookmarkability)
  useEffect(() => {
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const searchQuery = searchParams.get('q');
    const bankName = searchParams.get('bank');
    const accountId = searchParams.get('account');
    const type = searchParams.get('type') as TransactionType | null;
    const minAmountStr = searchParams.get('minAmount');
    const maxAmountStr = searchParams.get('maxAmount');
    const minAmount = minAmountStr ? parseFloat(minAmountStr) : null;
    const maxAmount = maxAmountStr ? parseFloat(maxAmountStr) : null;

    // Always sync URL to Redux, even if empty (to clear filters when URL is cleared)
    dispatch(setTransactionTableDateFilter({ from: dateFrom, to: dateTo }));
    dispatch(setTransactionTableGlobalFilter(searchQuery || ''));
    dispatch(setTransactionTableBankNameFilter(bankName));
    dispatch(setTransactionTableAccountIdFilter(accountId));
    dispatch(setTransactionTableTypeFilter(type));
    dispatch(setTransactionTableAmountFilter({ min: minAmount, max: maxAmount }));
  }, [searchParams, dispatch]);

  // Memoized callback for updating URL params when date filter changes
  const handleDateFilterChange = useCallback(
    (from: string | null, to: string | null) => {
      const params = new URLSearchParams(searchParams);
      if (from) {
        params.set('dateFrom', from);
      } else {
        params.delete('dateFrom');
      }
      if (to) {
        params.set('dateTo', to);
      } else {
        params.delete('dateTo');
      }

      // If both filters are cleared, also remove breadcrumb-related params
      if (!from && !to) {
        params.delete('returnTo');
        params.delete('breadcrumbLabel');
      }

      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Memoized callback for updating URL params when search query changes
  const handleSearchChange = useCallback(
    (query: string) => {
      const params = new URLSearchParams(searchParams);
      if (query) {
        params.set('q', query);
      } else {
        params.delete('q');
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Memoized callback for updating URL params when bank name filter changes
  const handleBankNameFilterChange = useCallback(
    (bankName: string | null) => {
      const params = new URLSearchParams(searchParams);
      if (bankName) {
        params.set('bank', bankName);
      } else {
        params.delete('bank');
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Memoized callback for updating URL params when account ID filter changes
  const handleAccountIdFilterChange = useCallback(
    (accountId: string | null) => {
      const params = new URLSearchParams(searchParams);
      if (accountId) {
        params.set('account', accountId);
      } else {
        params.delete('account');
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Memoized callback for updating URL params when type filter changes
  const handleTypeFilterChange = useCallback(
    (type: TransactionType | null) => {
      const params = new URLSearchParams(searchParams);
      if (type) {
        params.set('type', type);
      } else {
        params.delete('type');
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Memoized callback for updating URL params when amount filter changes
  const handleAmountFilterChange = useCallback(
    (min: number | null, max: number | null) => {
      const params = new URLSearchParams(searchParams);
      if (min !== null) {
        params.set('minAmount', min.toString());
      } else {
        params.delete('minAmount');
      }
      if (max !== null) {
        params.set('maxAmount', max.toString());
      } else {
        params.delete('maxAmount');
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Helper to check if any filters are active
  const hasActiveFilters = useCallback(() => {
    return !!(
      searchParams.get('dateFrom') ||
      searchParams.get('dateTo') ||
      searchParams.get('q') ||
      searchParams.get('bank') ||
      searchParams.get('account') ||
      searchParams.get('type') ||
      searchParams.get('minAmount') ||
      searchParams.get('maxAmount')
    );
  }, [searchParams]);

  // Clear all filter URL params at once (avoids race conditions from individual handlers)
  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete('dateFrom');
    params.delete('dateTo');
    params.delete('q');
    params.delete('bank');
    params.delete('account');
    params.delete('type');
    params.delete('minAmount');
    params.delete('maxAmount');
    params.delete('returnTo');
    params.delete('breadcrumbLabel');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  return {
    handleDateFilterChange,
    handleSearchChange,
    handleBankNameFilterChange,
    handleAccountIdFilterChange,
    handleTypeFilterChange,
    handleAmountFilterChange,
    hasActiveFilters,
    clearAllFilters,
  };
}
