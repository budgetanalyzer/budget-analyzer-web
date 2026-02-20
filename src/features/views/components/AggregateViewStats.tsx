// src/features/views/components/AggregateViewStats.tsx
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SavedView } from '@/types/view';
import { Transaction } from '@/types/transaction';
import { ExchangeRateResponse } from '@/types/currency';
import { useAggregateViewStats } from '@/features/views/hooks/useAggregateViewStats';
import { TransactionStatsGrid } from '@/features/transactions/components/TransactionStatsGrid';
import {
  buildMainStatsConfig,
  buildMonthlyStatsConfig,
} from '@/features/transactions/components/statsConfig';
import { layoutTransition } from '@/lib/animations';

interface AggregateViewStatsProps {
  views: SavedView[];
  selectedViewIds: string[];
  transactions: Transaction[];
  displayCurrency: string;
  exchangeRatesMap: Map<string, Map<string, ExchangeRateResponse>>;
  isExchangeRatesLoading: boolean;
}

export function AggregateViewStats({
  views,
  selectedViewIds,
  transactions,
  displayCurrency,
  exchangeRatesMap,
  isExchangeRatesLoading,
}: AggregateViewStatsProps) {
  // Get aggregated stats from the hook (must be called unconditionally)
  const { stats, monthlyAverages } = useAggregateViewStats({
    views,
    selectedViewIds,
    transactions,
    displayCurrency,
    exchangeRatesMap,
  });

  // Empty state when no views are selected
  if (selectedViewIds.length === 0) {
    return (
      <motion.div layout transition={layoutTransition}>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-medium">No views selected</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Select one or more views to see aggregate statistics
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Build stat card configurations
  const mainStatsConfig = buildMainStatsConfig(stats, displayCurrency);
  const monthlyStatsConfig = buildMonthlyStatsConfig(monthlyAverages, displayCurrency);

  return (
    <motion.div layout transition={layoutTransition} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold">Aggregate Statistics</h2>
          <Badge variant="secondary">{selectedViewIds.length} views selected</Badge>
        </div>
      </div>

      {/* Main statistics */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Overall Totals</h3>
        <TransactionStatsGrid stats={mainStatsConfig} isLoading={isExchangeRatesLoading} />
      </div>

      {/* Monthly averages */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Monthly Averages</h3>
        <TransactionStatsGrid stats={monthlyStatsConfig} isLoading={isExchangeRatesLoading} />
      </div>
    </motion.div>
  );
}
