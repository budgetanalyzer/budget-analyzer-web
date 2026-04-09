// src/features/admin/users/pages/UsersListPage.tsx
import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useUserSearch } from '@/hooks/useUsers';
import { UserSearchFiltersPanel } from '@/features/admin/users/components/UserSearchFiltersPanel';
import { UserSearchTable } from '@/features/admin/users/components/UserSearchTable';
import {
  buildAdminUserSearchParams,
  clearAdminUserFilters,
  parseAdminUserQuery,
  type PageSize,
} from '@/features/admin/users/utils/urlState';
import type { UserSearchQuery } from '@/types/user';

export function UsersListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => parseAdminUserQuery(searchParams), [searchParams]);

  // Track the latest query so multiple handleQueryChange calls in the same
  // commit (e.g. two debounced filter effects firing together) merge against
  // each other instead of all overwriting the closure-captured `query`.
  const queryRef = useRef(query);
  queryRef.current = query;

  const { data, isLoading, isFetching, error, refetch } = useUserSearch(query);

  const handleQueryChange = useCallback(
    (next: Partial<UserSearchQuery>) => {
      // Reset page to 0 on filter change unless caller explicitly sets it.
      const merged: UserSearchQuery = {
        ...queryRef.current,
        ...next,
        page: 'page' in next && next.page !== undefined ? next.page : 0,
      };
      queryRef.current = merged;
      setSearchParams(buildAdminUserSearchParams(merged), { replace: true });
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
    setSearchParams(clearAdminUserFilters(query), { replace: true });
  }, [query, setSearchParams]);

  return (
    <div className="h-full bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <PageHeader title="Users" description="Browse and inspect users (read-only)" />
        </div>

        <UserSearchFiltersPanel query={query} onChange={handleQueryChange} onClear={handleClear} />

        {error ? (
          <ErrorBanner error={error} onRetry={() => refetch()} />
        ) : (
          <UserSearchTable
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
