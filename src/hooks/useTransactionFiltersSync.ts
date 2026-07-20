import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { TransactionType } from '@/types/transaction';
import type { TransactionFilterValues } from '@/types/transactionFilters';
import { hasActiveTransactionFilters } from '@/utils/transactionFilters';

function parseAmount(value: string | null): number | null {
  if (!value?.trim()) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Reads and updates the shared URL-backed transaction filters.
 * The URL is the source of truth so filters stay refreshable and shareable.
 */
export function useTransactionFiltersSync() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<TransactionFilterValues>(() => {
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

  const handleAmountFilterChange = useCallback(
    (min: number | null, max: number | null) => {
      const params = new URLSearchParams(searchParams);
      if (min !== null && Number.isFinite(min)) {
        params.set('minAmount', min.toString());
      } else {
        params.delete('minAmount');
      }
      if (max !== null && Number.isFinite(max)) {
        params.set('maxAmount', max.toString());
      } else {
        params.delete('maxAmount');
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const hasActiveFilters = useCallback(() => hasActiveTransactionFilters(filters), [filters]);

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
