// src/components/analytics/YearlySpendingCard.tsx
import { Card, CardContent } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/currency';
import { motion } from 'framer-motion';
import { fadeInVariants, fadeTransition } from '@/lib/animations';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';
import { getYearBounds } from '@/lib/dateUtils';
import { buildTransactionsUrl } from '@/lib/urlBuilder';
import {
  buildAnalyticsReturnUrl,
  ViewMode,
  TransactionTypeParam,
} from '@/pages/analytics/urlState';

interface YearlySpendingCardProps {
  year: number;
  yearLabel: string;
  totalSpending: number;
  transactionCount: number;
  currency: string;
  viewMode: ViewMode;
  transactionType: TransactionTypeParam;
}

export function YearlySpendingCard({
  year,
  yearLabel,
  totalSpending,
  transactionCount,
  currency,
  viewMode,
  transactionType,
}: YearlySpendingCardProps) {
  // Calculate first and last day of year
  const { from: firstDay, to: lastDay } = getYearBounds(year);

  const isCredit = transactionType === 'credit';
  const Icon = isCredit ? TrendingUp : TrendingDown;
  const iconColorClass = isCredit ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground';
  const amountColorClass = isCredit ? 'text-green-600 dark:text-green-400' : 'text-foreground';

  // Build return URL with preserved state
  const returnTo = buildAnalyticsReturnUrl(viewMode, transactionType);

  // Build URL with date filters, return path, and breadcrumb label
  const transactionsUrl = buildTransactionsUrl({
    dateFrom: firstDay,
    dateTo: lastDay,
    returnTo,
    breadcrumbLabel: yearLabel,
  });

  return (
    <motion.div
      variants={fadeInVariants}
      initial="initial"
      animate="animate"
      transition={fadeTransition}
    >
      <Link to={transactionsUrl}>
        <Card className="h-full transition-shadow hover:shadow-md hover:border-primary cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex flex-col space-y-3">
              {/* Year Label */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">{yearLabel}</h3>
                <Icon className={`h-4 w-4 ${iconColorClass}`} />
              </div>

              {/* Total Spending */}
              <div className="space-y-1">
                <p className={`text-2xl font-bold ${amountColorClass}`}>
                  {formatCurrency(totalSpending, currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {transactionCount} {transactionCount === 1 ? 'transaction' : 'transactions'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
