// src/features/views/pages/ViewsPage.tsx
import { useEffect, useCallback } from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { Bookmark } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useViews } from '@/hooks/useViews';
import { useTransactions } from '@/hooks/useTransactions';
import { useExchangeRatesMap } from '@/hooks/useCurrencies';
import { useMissingCurrencies } from '@/hooks/useMissingCurrencies';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { toggleViewSelection, setSelectedViewIds } from '@/store/uiSlice';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorBanner } from '@/components/ErrorBanner';
import { MissingExchangeRatesBanner } from '@/components/MissingExchangeRatesBanner';
import { fadeInVariants, layoutTransition } from '@/lib/animations';
import { SelectableViewCard } from '@/features/views/components/SelectableViewCard';
import { AggregateViewStats } from '@/features/views/components/AggregateViewStats';

export function ViewsPage() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { data: views, isLoading, error, refetch } = useViews();
  const { data: transactions } = useTransactions();
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);
  const selectedViewIds = useAppSelector((state) => state.ui.selectedViewIds);
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

  // Convert selectedViewIds to Set for efficient lookup
  const selectedViewIdsSet = new Set(selectedViewIds);

  // Initialize selectedViewIds when views are loaded
  useEffect(() => {
    if (!views || views.length === 0) {
      return;
    }

    // If selectedViewIds is empty OR all IDs are invalid, select all views
    const validViewIds = new Set(views.map((v) => v.id));
    const hasValidSelection = selectedViewIds.some((id) => validViewIds.has(id));

    if (selectedViewIds.length === 0 || !hasValidSelection) {
      dispatch(setSelectedViewIds(views.map((v) => v.id)));
    }
  }, [views, selectedViewIds, dispatch]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" text="Loading views..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="w-full max-w-md">
          <ErrorBanner error={error} onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  const viewsList = Array.isArray(views) ? views : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved Views"
        description={`${viewsList.length} view${viewsList.length !== 1 ? 's' : ''}`}
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

      {viewsList.length === 0 ? (
        <motion.div
          variants={fadeInVariants}
          initial="initial"
          animate="animate"
          transition={layoutTransition}
        >
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Bookmark className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-2 text-lg font-medium">No saved views yet</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Create a view from the Transactions page by applying filters and clicking
                &ldquo;Save as View&rdquo;.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <LayoutGroup>
          {/* Aggregate Statistics */}
          {transactions && exchangeRatesMap && (
            <AggregateViewStats
              views={viewsList}
              selectedViewIds={selectedViewIds}
              transactions={transactions}
              displayCurrency={displayCurrency}
              exchangeRatesMap={exchangeRatesMap}
              isExchangeRatesLoading={isExchangeRatesLoading}
            />
          )}

          {/* View Cards Grid */}
          <motion.div
            variants={fadeInVariants}
            initial="initial"
            animate="animate"
            transition={layoutTransition}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {transactions &&
              exchangeRatesMap &&
              viewsList.map((view) => (
                <SelectableViewCard
                  key={view.id}
                  view={view}
                  isSelected={selectedViewIdsSet.has(view.id)}
                  onToggleSelection={() => dispatch(toggleViewSelection(view.id))}
                  transactions={transactions}
                  exchangeRatesMap={exchangeRatesMap}
                  displayCurrency={displayCurrency}
                />
              ))}
          </motion.div>
        </LayoutGroup>
      )}
    </div>
  );
}
