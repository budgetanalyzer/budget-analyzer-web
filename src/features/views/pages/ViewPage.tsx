// src/features/views/pages/ViewPage.tsx
import { useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion, LayoutGroup } from 'framer-motion';
import { ArrowLeft, Hash, Pin, Calendar, Settings2 } from 'lucide-react';
import { useView, useViewTransactions, viewKeys } from '@/hooks/useViews';
import { useExchangeRatesMap } from '@/hooks/useCurrencies';
import { useTransactions } from '@/hooks/useTransactions';
import { useAppSelector } from '@/store/hooks';
import { useTransactionStats } from '@/features/transactions/hooks/useTransactionStats';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorBanner } from '@/components/ErrorBanner';
import { ViewCriteriaSummary } from '@/features/views/components/ViewCriteriaSummary';
import { ViewTransactionTable } from '@/features/views/components/ViewTransactionTable';
import { ViewSettingsMenu } from '@/features/views/components/ViewSettingsMenu';
import { EditViewModal } from '@/features/views/components/EditViewModal';
import { DeleteViewModal } from '@/features/views/components/DeleteViewModal';
import { ManageViewTransactionsModal } from '@/features/views/components/ManageViewTransactionsModal';
import { TransactionStatsGrid } from '@/features/transactions/components/TransactionStatsGrid';
import { StatCardConfig } from '@/features/transactions/components/TransactionStatsGrid';
import { fadeInVariants, layoutTransition } from '@/lib/animations';
import { formatCurrency } from '@/utils/currency';
import { formatLocalDate, getDateRange } from '@/utils/dates';
import { viewApi } from '@/api/viewApi';
import { ViewMembershipResponse } from '@/types/view';
import { ApiError } from '@/types/apiError';

export function ViewPage() {
  const { id } = useParams<{ id: string }>();
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);

  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  const handleEditClick = useCallback(() => setIsEditModalOpen(true), []);
  const handleDeleteClick = useCallback(() => setIsDeleteModalOpen(true), []);
  const handleManageClick = useCallback(() => setIsManageModalOpen(true), []);
  const handleEditClose = useCallback(() => setIsEditModalOpen(false), []);
  const handleDeleteClose = useCallback(() => setIsDeleteModalOpen(false), []);
  const handleManageClose = useCallback(() => setIsManageModalOpen(false), []);

  // Fetch view metadata and transactions
  const {
    data: view,
    isLoading: isViewLoading,
    error: viewError,
    refetch: refetchView,
  } = useView(id!);

  const {
    data: transactions,
    isLoading: isTransactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useViewTransactions(id!);

  // Fetch all transactions (for manage modal)
  const { data: allTransactions } = useTransactions();

  // Fetch view membership (for manage modal)
  const { data: membership } = useQuery<ViewMembershipResponse, ApiError>({
    queryKey: viewKeys.transactions(id!),
    queryFn: () => viewApi.getViewTransactions(id!),
    staleTime: 1000 * 60 * 5,
    retry: 1,
    enabled: !!id,
  });

  // Fetch exchange rates for currency conversion
  const { exchangeRatesMap, isLoading: isExchangeRatesLoading } = useExchangeRatesMap({
    displayCurrency,
  });

  // Calculate stats with proper currency conversion
  const { stats: transactionStats } = useTransactionStats({
    transactions: transactions ?? [],
    displayCurrency,
    exchangeRatesMap,
  });

  const stats = useMemo<StatCardConfig[]>(() => {
    if (!transactions || !view) return [];

    const pinnedTransactions = transactions.filter((t) => t.membershipType === 'PINNED').length;

    // Calculate date range
    const dateRange = getDateRange(transactions.map((t) => t.date));
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
  }, [transactions, view, displayCurrency, transactionStats]);

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
          <ErrorBanner
            error={error}
            onRetry={() => {
              refetchView();
              refetchTransactions();
            }}
          />
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={view.name}
        description={`${transactions.length} transactions`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleManageClick}>
              <Settings2 className="mr-2 h-4 w-4" />
              Manage Transactions
            </Button>
            <ViewSettingsMenu
              view={view}
              onEditClick={handleEditClick}
              onDeleteClick={handleDeleteClick}
            />
          </div>
        }
      />

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
                transactions={transactions}
                viewId={id!}
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

      {/* Manage Transactions Modal */}
      {membership && allTransactions && (
        <ManageViewTransactionsModal
          open={isManageModalOpen}
          onClose={handleManageClose}
          view={view}
          membership={membership}
          allTransactions={allTransactions}
        />
      )}
    </div>
  );
}
