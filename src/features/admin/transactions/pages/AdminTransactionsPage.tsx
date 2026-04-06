// src/features/admin/transactions/pages/AdminTransactionsPage.tsx
import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useAdminTransactions } from '@/features/admin/transactions/api/useAdminTransactions';
import { AdminTransactionFilters } from '@/features/admin/transactions/components/AdminTransactionFilters';
import { AdminTransactionTable } from '@/features/admin/transactions/components/AdminTransactionTable';
import {
  buildAdminTxnSearchParams,
  clearAdminTxnFilters,
  parseAdminTxnQuery,
  type PageSize,
} from '@/features/admin/transactions/utils/urlState';
import type { AdminTransactionsQuery } from '@/types/adminTransaction';

export function AdminTransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => parseAdminTxnQuery(searchParams), [searchParams]);

  // Track the latest query so multiple handleQueryChange calls in the same
  // commit (e.g. two debounced filter effects firing together) merge against
  // each other instead of all overwriting the closure-captured `query`.
  const queryRef = useRef(query);
  queryRef.current = query;

  const { data, isLoading, isFetching, error, refetch } = useAdminTransactions(query);

  const handleQueryChange = useCallback(
    (next: Partial<AdminTransactionsQuery>) => {
      // Reset page to 0 on filter change unless caller explicitly sets it.
      const merged: AdminTransactionsQuery = {
        ...queryRef.current,
        ...next,
        page: 'page' in next && next.page !== undefined ? next.page : 0,
      };
      queryRef.current = merged;
      setSearchParams(buildAdminTxnSearchParams(merged), { replace: true });
    },
    [setSearchParams],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      handleQueryChange({ page });
    },
    [handleQueryChange],
  );

  const handleSizeChange = useCallback(
    (size: PageSize) => {
      handleQueryChange({ size, page: 0 });
    },
    [handleQueryChange],
  );

  const handleSortChange = useCallback(
    (sort: string[]) => {
      handleQueryChange({ sort, page: 0 });
    },
    [handleQueryChange],
  );

  const handleClear = useCallback(() => {
    setSearchParams(clearAdminTxnFilters(query), { replace: true });
  }, [query, setSearchParams]);

  return (
    <div className="h-full bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-8 py-10">
        <div className="mb-6">
          <PageHeader
            title="Transactions"
            description="Browse all users' transactions (read-only)"
          />
        </div>

        <AdminTransactionFilters query={query} onChange={handleQueryChange} onClear={handleClear} />

        {error ? (
          <ErrorBanner error={error} onRetry={() => refetch()} />
        ) : (
          <AdminTransactionTable
            data={data?.content ?? []}
            metadata={data?.metadata}
            sort={query.sort}
            isLoading={isLoading}
            isFetching={isFetching}
            onPageChange={handlePageChange}
            onSizeChange={handleSizeChange}
            onSortChange={handleSortChange}
          />
        )}
      </div>
    </div>
  );
}
