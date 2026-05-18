// src/features/transactions/hooks/useTransactionFiltersSync.ts
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { TransactionType } from '@/types/transaction';

interface TransactionFilters {
  globalFilter: string;
  dateFilter: {
    from: string | null;
    to: string | null;
  };
  bankNameFilter: string | null;
  accountIdFilter: string | null;
  typeFilter: TransactionType | null;
  amountFilter: {
    min: number | null;
    max: number | null;
  };
}

function parseAmount(value: string | null): number | null {
  if (!value) return null;

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Custom hook for reading and updating URL-backed transaction filters.
 * The URL is the source of truth so filters stay refreshable and shareable.
 *
 * @returns Object with handlers for updating filters and checking active state
 */
export function useTransactionFiltersSync() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<TransactionFilters>(() => {
    const type = searchParams.get('type');

    return {
      globalFilter: searchParams.get('q') ?? '',
      dateFilter: {
        from: searchParams.get('dateFrom'),
        to: searchParams.get('dateTo'),
      },
      bankNameFilter: searchParams.get('bankName') ?? searchParams.get('bank'),
      accountIdFilter: searchParams.get('accountId') ?? searchParams.get('account'),
      typeFilter: type === 'DEBIT' || type === 'CREDIT' ? type : null,
      amountFilter: {
        min: parseAmount(searchParams.get('minAmount')),
        max: parseAmount(searchParams.get('maxAmount')),
      },
    };
  }, [searchParams]);

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
        params.set('bankName', bankName);
      } else {
        params.delete('bankName');
      }
      params.delete('bank');
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Memoized callback for updating URL params when account ID filter changes
  const handleAccountIdFilterChange = useCallback(
    (accountId: string | null) => {
      const params = new URLSearchParams(searchParams);
      if (accountId) {
        params.set('accountId', accountId);
      } else {
        params.delete('accountId');
      }
      params.delete('account');
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
      searchParams.get('bankName') ||
      searchParams.get('bank') ||
      searchParams.get('accountId') ||
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
    params.delete('bankName');
    params.delete('bank');
    params.delete('accountId');
    params.delete('account');
    params.delete('type');
    params.delete('minAmount');
    params.delete('maxAmount');
    params.delete('returnTo');
    params.delete('breadcrumbLabel');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  return {
    filters,
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
