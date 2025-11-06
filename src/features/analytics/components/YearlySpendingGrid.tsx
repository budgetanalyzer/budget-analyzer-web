// src/features/analytics/components/YearlySpendingGrid.tsx
import { YearlySpendingCard } from './YearlySpendingCard';
import { YearlySpending } from '@/features/analytics/hooks/useAnalyticsData';
import { ViewMode, TransactionTypeParam } from '@/features/analytics/utils/urlState';

interface YearlySpendingGridProps {
  yearlyData: YearlySpending[];
  currency: string;
  viewMode: ViewMode;
  transactionType: TransactionTypeParam;
}

export function YearlySpendingGrid({
  yearlyData,
  currency,
  viewMode,
  transactionType,
}: YearlySpendingGridProps) {
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
        />
      ))}
    </div>
  );
}
