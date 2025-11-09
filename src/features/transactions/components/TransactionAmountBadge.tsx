// src/features/transactions/components/TransactionAmountBadge.tsx
import { ExchangeRateResponse } from '@/types/currency';
import { convertCurrency, formatCurrency } from '@/utils/currency';
import { Badge } from '@/components/ui/Badge';
import { motion } from 'framer-motion';
import { fadeInVariants, fadeTransition } from '@/lib/animations';

interface TransactionAmountBadgeProps {
  amount: number;
  date: string;
  currencyCode: string;
  displayCurrency: string;
  exchangeRatesMap: Map<string, Map<string, ExchangeRateResponse>>;
  isCredit: boolean;
}

export function TransactionAmountBadge({
  amount,
  date,
  currencyCode,
  displayCurrency,
  exchangeRatesMap,
  isCredit,
}: TransactionAmountBadgeProps) {
  const convertedAmount = convertCurrency(
    amount,
    date,
    currencyCode,
    displayCurrency,
    exchangeRatesMap,
  );

  const needsConversion = currencyCode !== displayCurrency;

  return (
    <motion.div
      variants={fadeInVariants}
      initial="initial"
      animate="animate"
      transition={fadeTransition}
      className="flex items-center justify-end gap-2"
    >
      <div
        className={`text-right font-semibold ${
          isCredit ? 'text-green-600 dark:text-green-400' : 'text-foreground'
        }`}
      >
        {formatCurrency(convertedAmount, displayCurrency)}
      </div>
      {needsConversion && (
        <Badge variant="outline" className="text-xs">
          {currencyCode}
        </Badge>
      )}
    </motion.div>
  );
}
