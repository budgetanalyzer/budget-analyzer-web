// src/components/analytics/MonthlySpendingCard.tsx
import { Card, CardContent } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { motion } from 'framer-motion';
import { fadeInVariants, fadeTransition } from '@/lib/animations';
import { TrendingDown } from 'lucide-react';
import { Link } from 'react-router';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface MonthlySpendingCardProps {
  year: number;
  month: number;
  monthLabel: string;
  totalSpending: number;
  transactionCount: number;
  currency: string;
}

export function MonthlySpendingCard({
  year,
  month,
  monthLabel,
  totalSpending,
  transactionCount,
  currency,
}: MonthlySpendingCardProps) {
  // Calculate first and last day of month (handles leap years correctly)
  const monthDate = new Date(year, month - 1, 1);
  const firstDay = format(startOfMonth(monthDate), 'yyyy-MM-dd');
  const lastDay = format(endOfMonth(monthDate), 'yyyy-MM-dd');

  return (
    <motion.div
      variants={fadeInVariants}
      initial="initial"
      animate="animate"
      transition={fadeTransition}
    >
      <Link to={`/?dateFrom=${firstDay}&dateTo=${lastDay}`}>
        <Card className="h-full transition-shadow hover:shadow-md hover:border-primary cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex flex-col space-y-3">
              {/* Month Label */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">{monthLabel}</h3>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Total Spending */}
              <div className="space-y-1">
                <p className="text-2xl font-bold text-foreground">
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
