// src/features/transactions/hooks/useTransactionFiltersSync.ts
import { useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { useAppDispatch } from '@/store/hooks';
import { setTransactionTableDateFilter, setTransactionTableGlobalFilter } from '@/store/uiSlice';

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

    // Always sync URL to Redux, even if empty (to clear filters when URL is cleared)
    dispatch(setTransactionTableDateFilter({ from: dateFrom, to: dateTo }));
    dispatch(setTransactionTableGlobalFilter(searchQuery || ''));
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

  // Helper to check if any filters are active
  const hasActiveFilters = useCallback(() => {
    return !!(searchParams.get('dateFrom') || searchParams.get('dateTo') || searchParams.get('q'));
  }, [searchParams]);

  return {
    handleDateFilterChange,
    handleSearchChange,
    hasActiveFilters,
  };
}
