// src/features/analytics/pages/AnalyticsPage.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useTransactions } from '@/hooks/useTransactions';
import { useView, useViews, useViewTransactions } from '@/hooks/useViews';
import { useExchangeRatesMap } from '@/hooks/useCurrencies';
import { useMissingCurrencies } from '@/hooks/useMissingCurrencies';
import { useAnalyticsData } from '@/features/analytics/hooks/useAnalyticsData';
import { fadeInVariants, layoutTransition, fadeVariants, fadeTransition } from '@/lib/animations';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { MissingExchangeRatesBanner } from '@/components/MissingExchangeRatesBanner';
import { PageHeader } from '@/components/PageHeader';
import { MonthlySpendingGrid } from '@/features/analytics/components/MonthlySpendingGrid';
import { YearlySpendingGrid } from '@/features/analytics/components/YearlySpendingGrid';
import { YearSelector } from '@/features/analytics/components/YearSelector';
import { ViewModeSelector } from '@/features/analytics/components/ViewModeSelector';
import { TransactionTypeSelector } from '@/features/analytics/components/TransactionTypeSelector';
import { AnalyticsSourceSelector } from '@/features/analytics/components/AnalyticsSourceSelector';
import { useAppSelector } from '@/store/hooks';
import { useSearchParams } from 'react-router';
import { useCallback, useEffect, useMemo } from 'react';
import { getCurrentYear } from '@/utils/dates';
import {
  ANALYTICS_PARAMS,
  ViewMode,
  TransactionTypeParam,
  AnalyticsScope,
  parseAnalyticsSearchParams,
} from '@/features/analytics/utils/urlState';

export function AnalyticsPage() {
  const queryClient = useQueryClient();
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);
  const [searchParams, setSearchParams] = useSearchParams();

  const analyticsUrlState = useMemo(() => parseAnalyticsSearchParams(searchParams), [searchParams]);

  const { scope: analyticsScope, viewId, viewMode, transactionType } = analyticsUrlState;
  const activeViewId = analyticsScope === 'view' ? (viewId ?? '') : '';

  const {
    data: transactions,
    isLoading: isTransactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useTransactions({ enabled: analyticsScope === 'all' });

  const { data: views, isLoading: isViewsLoading, error: viewsError } = useViews();

  const {
    data: activeView,
    isLoading: isViewLoading,
    error: viewError,
    refetch: refetchView,
  } = useView(activeViewId);

  const {
    data: viewTransactions,
    isLoading: isViewTransactionsLoading,
    error: viewTransactionsError,
    refetch: refetchViewTransactions,
  } = useViewTransactions(activeViewId);

  const resolvedTransactions = analyticsScope === 'view' ? viewTransactions : transactions;
  const isSourceLoading =
    analyticsScope === 'view' ? isViewLoading || isViewTransactionsLoading : isTransactionsLoading;
  const sourceError =
    analyticsScope === 'view' ? viewError || viewTransactionsError : transactionsError;

  // Fetch exchange rates for currency conversion
  const {
    exchangeRatesMap,
    pendingCurrencies,
    isLoading: isExchangeRatesLoading,
  } = useExchangeRatesMap({
    displayCurrency,
  });

  const disabledCurrencies = useMissingCurrencies();

  const handleRefreshExchangeRates = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['exchangeRates'] });
    queryClient.invalidateQueries({ queryKey: ['currencies'] });
  }, [queryClient]);

  const handleRetrySource = useCallback(() => {
    if (analyticsScope === 'view') {
      refetchView();
      refetchViewTransactions();
      return;
    }

    refetchTransactions();
  }, [analyticsScope, refetchTransactions, refetchView, refetchViewTransactions]);

  // Get selected year from URL or default to current year (will be updated to latestYear with data)
  const currentYear = useMemo(() => getCurrentYear(), []);
  const yearParam = searchParams.get(ANALYTICS_PARAMS.YEAR);
  const selectedYear = analyticsUrlState.year ?? currentYear;

  // Process analytics data with memoization
  const { monthlySpending, yearlySpending, earliestYear, latestYear, yearsWithTransactions } =
    useAnalyticsData(
      resolvedTransactions,
      displayCurrency,
      exchangeRatesMap,
      selectedYear,
      transactionType,
    );

  // Initialize to latest year with transactions if no year param exists
  // Or redirect if selected year is out of valid range
  useEffect(() => {
    if (isSourceLoading || !resolvedTransactions) {
      return;
    }

    // If no year parameter, default to the latest year with actual transactions
    if (!yearParam || analyticsUrlState.year === undefined) {
      const params = new URLSearchParams(searchParams);
      params.set(ANALYTICS_PARAMS.YEAR, latestYear.toString());
      setSearchParams(params, { replace: true });
      return;
    }

    // If year parameter exists but is out of valid range, redirect to nearest valid year
    if (!isNaN(selectedYear)) {
      let redirectYear: number | null = null;

      if (selectedYear < earliestYear) {
        redirectYear = earliestYear;
      } else if (selectedYear > currentYear) {
        redirectYear = currentYear;
      }

      if (redirectYear !== null) {
        const params = new URLSearchParams(searchParams);
        params.set(ANALYTICS_PARAMS.YEAR, redirectYear.toString());
        setSearchParams(params, { replace: true });
      }
    }
  }, [
    isSourceLoading,
    resolvedTransactions,
    yearParam,
    selectedYear,
    earliestYear,
    latestYear,
    currentYear,
    searchParams,
    setSearchParams,
    analyticsUrlState.year,
  ]);

  const handleSourceChange = useCallback(
    ({ scope, viewId: nextViewId }: { scope: AnalyticsScope; viewId?: string }) => {
      const params = new URLSearchParams(searchParams);
      params.set(ANALYTICS_PARAMS.SCOPE, scope);

      if (scope === 'view' && nextViewId) {
        params.set(ANALYTICS_PARAMS.VIEW_ID, nextViewId);
      } else {
        params.delete(ANALYTICS_PARAMS.VIEW_ID);
      }

      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  // Handle year change
  const handleYearChange = useCallback(
    (year: number) => {
      const params = new URLSearchParams(searchParams);
      params.set(ANALYTICS_PARAMS.YEAR, year.toString());
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Handle view mode change
  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      const params = new URLSearchParams(searchParams);
      params.set(ANALYTICS_PARAMS.VIEW_MODE, mode);
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  // Handle transaction type change
  const handleTransactionTypeChange = useCallback(
    (type: TransactionTypeParam) => {
      const params = new URLSearchParams(searchParams);
      params.set(ANALYTICS_PARAMS.TRANSACTION_TYPE, type);
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const pageDescription = useMemo(() => {
    const sourceSuffix = analyticsScope === 'view' && activeView ? ` in ${activeView.name}` : '';

    return viewMode === 'monthly'
      ? `Monthly spending breakdown for ${selectedYear}${sourceSuffix}`
      : `Yearly spending overview${sourceSuffix}`;
  }, [activeView, analyticsScope, selectedYear, viewMode]);

  if (isSourceLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" text="Loading analytics..." />
      </div>
    );
  }

  if (sourceError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md">
          <ErrorBanner error={sourceError} onRetry={handleRetrySource} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description={pageDescription} />

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

      <motion.div
        variants={fadeInVariants}
        initial="initial"
        animate="animate"
        transition={layoutTransition}
        className="grid gap-4 md:grid-cols-[minmax(12rem,1fr)_auto_auto_minmax(12rem,1fr)] md:items-end"
      >
        <div className="flex justify-start">
          <AnalyticsSourceSelector
            scope={analyticsScope}
            viewId={viewId}
            selectedViewName={activeView?.name}
            views={views ?? []}
            isLoadingViews={isViewsLoading}
            hasViewsError={!!viewsError}
            onChange={handleSourceChange}
          />
        </div>
        <div className="flex justify-start md:justify-center">
          <ViewModeSelector selectedMode={viewMode} onChange={handleViewModeChange} />
        </div>
        <div className="flex justify-start md:justify-center">
          <TransactionTypeSelector
            selectedType={transactionType}
            onChange={handleTransactionTypeChange}
          />
        </div>
        <div className="flex justify-start md:justify-end">
          {viewMode === 'monthly' && (
            <YearSelector
              selectedYear={selectedYear}
              years={yearsWithTransactions}
              onChange={handleYearChange}
            />
          )}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode === 'monthly' ? selectedYear : 'yearly'}
          variants={fadeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={fadeTransition}
        >
          {viewMode === 'monthly' ? (
            <MonthlySpendingGrid
              monthlyData={monthlySpending}
              currency={displayCurrency}
              viewMode={viewMode}
              transactionType={transactionType}
              analyticsScope={analyticsScope}
              viewId={viewId}
            />
          ) : (
            <YearlySpendingGrid
              yearlyData={yearlySpending}
              currency={displayCurrency}
              viewMode={viewMode}
              transactionType={transactionType}
              analyticsScope={analyticsScope}
              viewId={viewId}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {isExchangeRatesLoading && (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="sm" text="Loading exchange rates..." />
        </div>
      )}
    </div>
  );
}
