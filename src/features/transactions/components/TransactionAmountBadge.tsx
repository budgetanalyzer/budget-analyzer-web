// src/features/transactions/components/TransactionAmountBadge.tsx
import { formatCurrency } from '@/utils/currency';
import type { DisplayAmount } from '@/types/displayAmount';
import { Badge } from '@/components/ui/Badge';
import { motion } from 'motion/react';
import { fadeInVariants, fadeTransition } from '@/lib/animations';

interface TransactionAmountBadgeProps {
  displayAmount: DisplayAmount;
  isCredit: boolean;
}

export function TransactionAmountBadge({ displayAmount, isCredit }: TransactionAmountBadgeProps) {
  const formattedAmount = displayAmount.available
    ? formatCurrency(displayAmount.value, displayAmount.targetCurrency)
    : formatCurrency(displayAmount.sourceMagnitude, displayAmount.sourceCurrency);
  const needsConversion =
    displayAmount.available && displayAmount.sourceCurrency !== displayAmount.targetCurrency;

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
        {formattedAmount}
        {!displayAmount.available && (
          <div className="text-xs font-normal text-warning">
            Conversion to {displayAmount.targetCurrency} unavailable
          </div>
        )}
      </div>
      {needsConversion && (
        <Badge variant="outline" className="text-xs">
          {displayAmount.sourceCurrency}
        </Badge>
      )}
    </motion.div>
  );
}
