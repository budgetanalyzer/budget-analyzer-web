// src/features/views/components/SelectableViewCard.tsx
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  Bookmark,
  Calendar,
  Search,
  Hash,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Check,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SavedView } from '@/types/view';
import { Transaction } from '@/types/transaction';
import { ExchangeRateResponse } from '@/types/currency';
import { formatLocalDate } from '@/utils/dates';
import { formatCurrency, convertCurrency } from '@/utils/currency';
import { fadeInVariants } from '@/lib/animations';
import { filterTransactionsByCriteria } from '@/utils/filterTransactions';

interface SelectableViewCardProps {
  view: SavedView;
  isSelected: boolean;
  onToggleSelection: () => void;
  transactions: Transaction[];
  exchangeRatesMap: Map<string, Map<string, ExchangeRateResponse>>;
  displayCurrency: string;
}

export function SelectableViewCard({
  view,
  isSelected,
  onToggleSelection,
  transactions,
  exchangeRatesMap,
  displayCurrency,
}: SelectableViewCardProps) {
  const navigate = useNavigate();

  // Calculate stats for this view
  const { totalCredits, totalDebits } = useMemo(() => {
    const filteredTransactions = filterTransactionsByCriteria(transactions, view.criteria);

    return filteredTransactions.reduce(
      (acc, t) => {
        const convertedAmount = convertCurrency(
          Math.abs(t.amount),
          t.date,
          t.currencyIsoCode,
          displayCurrency,
          exchangeRatesMap,
        );

        if (t.type === 'CREDIT') {
          acc.totalCredits += convertedAmount;
        } else {
          acc.totalDebits += convertedAmount;
        }

        return acc;
      },
      { totalCredits: 0, totalDebits: 0 },
    );
  }, [view.criteria, transactions, displayCurrency, exchangeRatesMap]);

  // Card click handler - toggle selection
  const handleCardClick = useCallback(() => {
    onToggleSelection();
  }, [onToggleSelection]);

  // Navigate button handler - prevent event bubbling to card
  const handleNavigateClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/views/${view.id}`);
    },
    [navigate, view.id],
  );

  // Keyboard handlers for accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        onToggleSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        navigate(`/views/${view.id}`);
      }
    },
    [onToggleSelection, navigate, view.id],
  );

  const criteria = view.criteria;

  return (
    <motion.div variants={fadeInVariants}>
      <Card
        className={`h-full cursor-pointer transition-all ${
          isSelected
            ? 'border-primary bg-primary/5 shadow-md'
            : 'hover:border-primary/50 hover:bg-muted/50'
        }`}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        role="checkbox"
        aria-checked={isSelected}
        tabIndex={0}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bookmark className="h-4 w-4 text-primary" />
              {view.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              {view.openEnded && (
                <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400">
                  Open-ended
                </Badge>
              )}
              {isSelected && (
                <div className="rounded-full bg-primary p-1">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Criteria badges */}
          <div className="flex flex-wrap gap-1.5">
            {(criteria.startDate || criteria.endDate) && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Calendar className="h-3 w-3" />
                {criteria.startDate ? formatLocalDate(criteria.startDate) : 'Any'} -{' '}
                {criteria.endDate ? formatLocalDate(criteria.endDate) : 'Ongoing'}
              </Badge>
            )}
            {criteria.searchText && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Search className="h-3 w-3" />
                &ldquo;{criteria.searchText}&rdquo;
              </Badge>
            )}
            {criteria.accountIds && criteria.accountIds.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {criteria.accountIds.length} account{criteria.accountIds.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Financial summary */}
          <div className="flex items-center gap-4 text-sm">
            {totalCredits > 0 && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <TrendingUp className="h-3.5 w-3.5" />
                {formatCurrency(totalCredits, displayCurrency)}
              </span>
            )}
            {totalDebits > 0 && (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <TrendingDown className="h-3.5 w-3.5" />
                {formatCurrency(totalDebits, displayCurrency)}
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" />
                {view.transactionCount} transactions
              </span>
              {view.pinnedCount > 0 && (
                <span className="flex items-center gap-1 text-primary">
                  <Bookmark className="h-3.5 w-3.5 fill-current" />
                  {view.pinnedCount} pinned
                </span>
              )}
              {view.excludedCount > 0 && (
                <span className="flex items-center gap-1">
                  <EyeOff className="h-3.5 w-3.5" />
                  {view.excludedCount} excluded
                </span>
              )}
            </div>
            <button
              onClick={handleNavigateClick}
              className="flex items-center gap-1 rounded-md px-2 py-1 font-medium text-primary transition-colors hover:bg-primary/10"
              aria-label={`View details for ${view.name}`}
            >
              View Details
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
