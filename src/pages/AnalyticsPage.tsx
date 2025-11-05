// src/pages/AnalyticsPage.tsx
import { motion } from 'framer-motion';
import { useTransactions } from '@/hooks/useTransactions';
import { useExchangeRatesMap } from '@/hooks/useCurrencies';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { fadeInVariants, layoutTransition } from '@/lib/animations';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { MonthlySpendingGrid } from '@/components/analytics/MonthlySpendingGrid';
import { useAppSelector } from '@/store/hooks';

export function AnalyticsPage() {
  const { data: transactions, isLoading, error, refetch } = useTransactions();
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);

  // Fetch exchange rates for currency conversion
  const { exchangeRatesMap, isLoading: isExchangeRatesLoading } = useExchangeRatesMap();

  // Process analytics data with memoization
  const { monthlySpending, currentYear } = useAnalyticsData(
    transactions,
    displayCurrency,
    exchangeRatesMap,
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
      <PageHeader title="Analytics" description={`Monthly spending breakdown for ${currentYear}`} />

      <motion.div
        variants={fadeInVariants}
        initial="initial"
        animate="animate"
        transition={layoutTransition}
      >
        <MonthlySpendingGrid monthlyData={monthlySpending} currency={displayCurrency} />
      </motion.div>

      {isExchangeRatesLoading && (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="sm" text="Loading exchange rates..." />
        </div>
      )}
    </div>
  );
}
