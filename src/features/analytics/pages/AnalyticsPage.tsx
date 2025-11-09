// src/features/analytics/pages/AnalyticsPage.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useTransactions } from '@/hooks/useTransactions';
import { useExchangeRatesMap } from '@/hooks/useCurrencies';
import { useAnalyticsData } from '@/features/analytics/hooks/useAnalyticsData';
import { fadeInVariants, layoutTransition, fadeVariants, fadeTransition } from '@/lib/animations';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { MonthlySpendingGrid } from '@/features/analytics/components/MonthlySpendingGrid';
import { YearlySpendingGrid } from '@/features/analytics/components/YearlySpendingGrid';
import { YearSelector } from '@/features/analytics/components/YearSelector';
import { ViewModeSelector } from '@/features/analytics/components/ViewModeSelector';
import { TransactionTypeSelector } from '@/features/analytics/components/TransactionTypeSelector';
import { useAppSelector } from '@/store/hooks';
import { useSearchParams } from 'react-router';
import { useCallback, useEffect, useMemo } from 'react';
import { getCurrentYear } from '@/utils/dates';
import {
  ANALYTICS_PARAMS,
  VIEW_MODES,
  TRANSACTION_TYPES,
  ViewMode,
  TransactionTypeParam,
} from '@/features/analytics/utils/urlState';

export function AnalyticsPage() {
  const { data: transactions, isLoading, error, refetch } = useTransactions();
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);
  const [searchParams, setSearchParams] = useSearchParams();

  // Get view mode and transaction type from URL params with defaults
  const viewMode = (searchParams.get(ANALYTICS_PARAMS.VIEW_MODE) as ViewMode) || VIEW_MODES.MONTHLY;
  const transactionType =
    (searchParams.get(ANALYTICS_PARAMS.TRANSACTION_TYPE) as TransactionTypeParam) ||
    TRANSACTION_TYPES.DEBIT;

  // Fetch exchange rates for currency conversion
  const { exchangeRatesMap, isLoading: isExchangeRatesLoading } = useExchangeRatesMap({
    transactions,
    displayCurrency,
  });

  // Get selected year from URL or default to current year
  const currentYear = useMemo(() => getCurrentYear(), []);
  const yearParam = searchParams.get(ANALYTICS_PARAMS.YEAR);
  const selectedYear = yearParam ? parseInt(yearParam, 10) : currentYear;

  // Process analytics data with memoization
  const { monthlySpending, yearlySpending, earliestYear } = useAnalyticsData(
    transactions,
    displayCurrency,
    exchangeRatesMap,
    selectedYear,
    transactionType,
  );

  // Redirect if selected year is out of valid range (before earliest transaction or after current year)
  // Only run after transactions have loaded to avoid redirecting based on temporary default values
  useEffect(() => {
    if (isLoading || !transactions) {
      return;
    }

    if (yearParam && !isNaN(selectedYear)) {
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
    isLoading,
    transactions,
    yearParam,
    selectedYear,
    earliestYear,
    currentYear,
    searchParams,
    setSearchParams,
  ]);

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

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" text="Loading analytics..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md">
          <ErrorBanner error={error} onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={
          viewMode === 'monthly'
            ? `Monthly spending breakdown for ${selectedYear}`
            : 'Yearly spending overview'
        }
      />

      <motion.div
        variants={fadeInVariants}
        initial="initial"
        animate="animate"
        transition={layoutTransition}
        className="grid grid-cols-3 items-center gap-4"
      >
        <div className="flex justify-start">
          <ViewModeSelector selectedMode={viewMode} onChange={handleViewModeChange} />
        </div>
        <div className="flex justify-center">
          <TransactionTypeSelector
            selectedType={transactionType}
            onChange={handleTransactionTypeChange}
          />
        </div>
        <div className="flex justify-end">
          {viewMode === 'monthly' && (
            <YearSelector
              selectedYear={selectedYear}
              earliestYear={earliestYear}
              latestYear={currentYear}
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
            />
          ) : (
            <YearlySpendingGrid
              yearlyData={yearlySpending}
              currency={displayCurrency}
              viewMode={viewMode}
              transactionType={transactionType}
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
