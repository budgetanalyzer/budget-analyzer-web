// src/features/views/pages/ViewPage.tsx
import { useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Hash, Pin, Calendar, Eye, BarChart3 } from 'lucide-react';
import { useView, useViewTransactions } from '@/hooks/useViews';
import { useExchangeRatesMap } from '@/hooks/useCurrencies';
import { useMissingCurrencies } from '@/hooks/useMissingCurrencies';
import { useAppSelector } from '@/store/hooks';
import { useTransactionStats } from '@/features/transactions/hooks/useTransactionStats';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorBanner } from '@/components/ErrorBanner';
import { MissingExchangeRatesBanner } from '@/components/MissingExchangeRatesBanner';
import { ViewCriteriaSummary } from '@/features/views/components/ViewCriteriaSummary';
import { ViewTransactionTable } from '@/features/views/components/ViewTransactionTable';
import { ViewSettingsMenu } from '@/features/views/components/ViewSettingsMenu';
import { EditViewModal } from '@/features/views/components/EditViewModal';
import { DeleteViewModal } from '@/features/views/components/DeleteViewModal';
import { RestoreExcludedTransactionsModal } from '@/features/views/components/RestoreExcludedTransactionsModal';
import { useViewTransactionFiltersSync } from '@/features/views/hooks/useViewTransactionFiltersSync';
import { TransactionStatsGrid } from '@/features/transactions/components/TransactionStatsGrid';
import { StatCardConfig } from '@/features/transactions/components/TransactionStatsGrid';
import { fadeInVariants, layoutTransition } from '@/lib/animations';
import { formatCurrency } from '@/utils/currency';
import { compareLocalDates, formatLocalDate, getDateRange } from '@/utils/dates';
import { filterTransactionsByTableSearch } from '@/utils/transactionSearch';
import { buildAnalyticsReturnUrl } from '@/features/analytics/utils/urlState';

export function ViewPage() {
  const { id } = useParams<{ id: string }>();

  return <ViewPageContent key={id} id={id!} />;
}

function ViewPageContent({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);

  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  const handleEditClick = useCallback(() => setIsEditModalOpen(true), []);
  const handleDeleteClick = useCallback(() => setIsDeleteModalOpen(true), []);
  const handleRestoreClick = useCallback(() => setIsRestoreModalOpen(true), []);
  const handleEditClose = useCallback(() => setIsEditModalOpen(false), []);
  const handleDeleteClose = useCallback(() => setIsDeleteModalOpen(false), []);
  const handleRestoreClose = useCallback(() => setIsRestoreModalOpen(false), []);

  const {
    dateFilter,
    searchText,
    handleDateFilterChange,
    handleSearchChange,
    clearAllFilters,
    hasActiveFilters,
  } = useViewTransactionFiltersSync();

  const handleRefreshExchangeRates = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['exchangeRates'] });
    queryClient.invalidateQueries({ queryKey: ['currencies'] });
  }, [queryClient]);

  // Fetch view metadata and transactions
  const {
    data: view,
    isLoading: isViewLoading,
    error: viewError,
    refetch: refetchView,
  } = useView(id);

  const {
    data: transactions,
    isLoading: isTransactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useViewTransactions(id);

  const handleRetry = useCallback(() => {
    refetchView();
    refetchTransactions();
  }, [refetchTransactions, refetchView]);

  // Fetch exchange rates for currency conversion
  const {
    exchangeRatesMap,
    pendingCurrencies,
    isLoading: isExchangeRatesLoading,
  } = useExchangeRatesMap({
    displayCurrency,
  });

  const disabledCurrencies = useMissingCurrencies();

  const filteredTransactions = useMemo(() => {
    let filtered = transactions ?? [];

    if (dateFilter.from) {
      const dateFrom = dateFilter.from;
      filtered = filtered.filter(
        (transaction) => compareLocalDates(transaction.date, dateFrom) >= 0,
      );
    }

    if (dateFilter.to) {
      const dateTo = dateFilter.to;
      filtered = filtered.filter((transaction) => compareLocalDates(transaction.date, dateTo) <= 0);
    }

    return filterTransactionsByTableSearch(filtered, searchText);
  }, [dateFilter.from, dateFilter.to, searchText, transactions]);

  // Calculate stats with proper currency conversion
  const { stats: transactionStats } = useTransactionStats({
    transactions: filteredTransactions,
    displayCurrency,
    exchangeRatesMap,
  });

  const stats = useMemo<StatCardConfig[]>(() => {
    if (!transactions || !view) return [];

    const pinnedTransactions = filteredTransactions.filter(
      (t) => t.membershipType === 'PINNED',
    ).length;

    // Calculate date range
    const dateRange = getDateRange(filteredTransactions.map((t) => t.date));
    let dateRangeDescription = 'No transactions';
    if (dateRange) {
      if (dateRange.earliest === dateRange.latest) {
        dateRangeDescription = formatLocalDate(dateRange.earliest);
      } else {
        dateRangeDescription = `${formatLocalDate(dateRange.earliest)} - ${formatLocalDate(dateRange.latest)}`;
      }
    }

    return [
      {
        title: 'Total Transactions',
        value: transactionStats.totalTransactions.toString(),
        description: dateRangeDescription,
        icon: Hash,
        iconClassName: 'text-blue-500',
      },
      {
        title: 'Pinned',
        value: pinnedTransactions.toString(),
        description: 'Manually pinned to view',
        icon: Pin,
        iconClassName: 'text-primary',
      },
      {
        title: 'Total Spend',
        value: formatCurrency(transactionStats.totalDebits, displayCurrency),
        description: 'Sum of debits',
        icon: Calendar,
        iconClassName: 'text-red-500',
        valueClassName: 'text-red-600 dark:text-red-400',
      },
      {
        title: 'Total Income',
        value: formatCurrency(transactionStats.totalCredits, displayCurrency),
        description: 'Sum of credits',
        icon: Calendar,
        iconClassName: 'text-green-500',
        valueClassName: 'text-green-600 dark:text-green-400',
      },
    ];
  }, [transactions, view, filteredTransactions, displayCurrency, transactionStats]);

  const isLoading = isViewLoading || isTransactionsLoading;
  const error = viewError || transactionsError;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" text="Loading view..." />
      </div>
    );
  }

  if (error) {
    // Handle 404 specifically with a better message
    const is404 = error.status === 404;
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="w-full max-w-md">
          <ErrorBanner error={error} onRetry={handleRetry} />
        </div>
        {is404 && (
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Transactions
            </Button>
          </Link>
        )}
      </div>
    );
  }

  if (!view || !transactions) {
    return null;
  }

  const analyzeViewUrl = buildAnalyticsReturnUrl({
    scope: 'view',
    viewId: id,
    viewMode: 'monthly',
    transactionType: 'debit',
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={view.name}
        description={`${transactions.length} transactions`}
        action={
          <div className="flex items-center gap-2">
            <Link
              to={analyzeViewUrl}
              className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Analyze View
            </Link>
            {view.excludedCount > 0 && (
              <Button variant="outline" onClick={handleRestoreClick}>
                <Eye className="mr-2 h-4 w-4" />
                Restore Excluded
              </Button>
            )}
            <ViewSettingsMenu
              view={view}
              onEditClick={handleEditClick}
              onDeleteClick={handleDeleteClick}
            />
          </div>
        }
      />

      <AnimatePresence>
        {(disabledCurrencies.length > 0 || pendingCurrencies.length > 0) && (
          <MissingExchangeRatesBanner
            disabledCurrencies={disabledCurrencies}
            pendingCurrencies={pendingCurrencies}
            onRefresh={handleRefreshExchangeRates}
            isRefreshing={isExchangeRatesLoading}
          />
        )}
      </AnimatePresence>

      {/* Criteria Summary */}
      <motion.div
        variants={fadeInVariants}
        initial="initial"
        animate="animate"
        transition={layoutTransition}
      >
        <Card>
          <CardContent className="py-4">
            <ViewCriteriaSummary
              criteria={view.criteria}
              excludedCount={view.excludedCount}
              openEnded={view.openEnded}
              onRestoreExcludedClick={handleRestoreClick}
            />
          </CardContent>
        </Card>
      </motion.div>

      <LayoutGroup>
        {/* Stats Grid */}
        <motion.div layout transition={layoutTransition}>
          <TransactionStatsGrid stats={stats} isLoading={isExchangeRatesLoading} />
        </motion.div>

        {/* Transactions Table */}
        <motion.div
          layout
          variants={fadeInVariants}
          initial="initial"
          animate="animate"
          transition={layoutTransition}
        >
          <Card>
            <CardContent className="pt-6">
              <ViewTransactionTable
                transactions={filteredTransactions}
                viewId={id}
                searchText={searchText}
                dateFilter={dateFilter}
                hasActiveFilters={hasActiveFilters}
                onSearchChange={handleSearchChange}
                onDateFilterChange={handleDateFilterChange}
                onClearAllFilters={clearAllFilters}
                displayCurrency={displayCurrency}
                exchangeRatesMap={exchangeRatesMap}
                isExchangeRatesLoading={isExchangeRatesLoading}
              />
            </CardContent>
          </Card>
        </motion.div>
      </LayoutGroup>

      {/* Edit View Modal */}
      <EditViewModal open={isEditModalOpen} onClose={handleEditClose} view={view} />

      {/* Delete View Modal */}
      <DeleteViewModal open={isDeleteModalOpen} onClose={handleDeleteClose} view={view} />

      {view.excludedCount > 0 && isRestoreModalOpen && (
        <RestoreExcludedTransactionsModal
          open={isRestoreModalOpen}
          onClose={handleRestoreClose}
          view={view}
        />
      )}
    </div>
  );
}
