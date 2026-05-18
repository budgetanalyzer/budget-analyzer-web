import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

export interface ViewTransactionDateFilter {
  from: string | null;
  to: string | null;
}

export function useViewTransactionFiltersSync() {
  const [searchParams, setSearchParams] = useSearchParams();

  const dateFilter = useMemo<ViewTransactionDateFilter>(
    () => ({
      from: searchParams.get('dateFrom'),
      to: searchParams.get('dateTo'),
    }),
    [searchParams],
  );

  const searchText = searchParams.get('q') || '';

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

      if (!from && !to) {
        params.delete('returnTo');
        params.delete('breadcrumbLabel');
      }

      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

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

  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete('dateFrom');
    params.delete('dateTo');
    params.delete('q');
    params.delete('returnTo');
    params.delete('breadcrumbLabel');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const hasActiveFilters = !!(dateFilter.from || dateFilter.to || searchText);

  return {
    dateFilter,
    searchText,
    handleDateFilterChange,
    handleSearchChange,
    clearAllFilters,
    hasActiveFilters,
  };
}
