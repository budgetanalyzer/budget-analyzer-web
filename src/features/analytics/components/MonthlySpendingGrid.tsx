// src/features/analytics/components/MonthlySpendingGrid.tsx
import { MonthlySpendingCard } from './MonthlySpendingCard';
import { MonthlySpending } from '@/features/analytics/hooks/useAnalyticsData';
import { ViewMode, TransactionTypeParam } from '@/features/analytics/utils/urlState';

interface MonthlySpendingGridProps {
  monthlyData: MonthlySpending[];
  currency: string;
  viewMode: ViewMode;
  transactionType: TransactionTypeParam;
}

export function MonthlySpendingGrid({
  monthlyData,
  currency,
  viewMode,
  transactionType,
}: MonthlySpendingGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {monthlyData.map((month) => (
        <MonthlySpendingCard
          key={`${month.year}-${month.month}`}
          year={month.year}
          month={month.month}
          monthLabel={month.monthLabel}
          totalSpending={month.totalSpending}
          transactionCount={month.transactionCount}
          currency={currency}
          viewMode={viewMode}
          transactionType={transactionType}
        />
      ))}
    </div>
  );
}
