// src/features/analytics/components/YearlySpendingGrid.tsx
import { YearlySpendingCard } from './YearlySpendingCard';
import { YearlySpending } from '@/features/analytics/hooks/useAnalyticsData';
import {
  AnalyticsScope,
  ViewMode,
  TransactionTypeParam,
} from '@/features/analytics/utils/urlState';

interface YearlySpendingGridProps {
  yearlyData: YearlySpending[];
  currency: string;
  viewMode: ViewMode;
  transactionType: TransactionTypeParam;
  analyticsScope: AnalyticsScope;
  viewId?: string;
}

export function YearlySpendingGrid({
  yearlyData,
  currency,
  viewMode,
  transactionType,
  analyticsScope,
  viewId,
}: YearlySpendingGridProps) {
  if (yearlyData.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-12 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          No yearly analytics for {transactionType} transactions.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {yearlyData.map((year) => (
        <YearlySpendingCard
          key={year.year}
          year={year.year}
          yearLabel={year.yearLabel}
          totalSpending={year.totalSpending}
          transactionCount={year.transactionCount}
          currency={currency}
          viewMode={viewMode}
          transactionType={transactionType}
          analyticsScope={analyticsScope}
          viewId={viewId}
        />
      ))}
    </div>
  );
}
