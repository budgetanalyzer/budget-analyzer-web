import { motion } from 'motion/react';
import { fadeInVariants, fadeTransition } from '@/lib/animations';
import type { DisplayAmount } from '@/types/displayAmount';
import { formatCurrency } from '@/utils/currency';

interface TransactionAmountBadgeProps {
  displayAmount: DisplayAmount;
  isCredit: boolean;
}

export function TransactionAmountBadge({ displayAmount, isCredit }: TransactionAmountBadgeProps) {
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
        {displayAmount.available ? (
          formatCurrency(displayAmount.value, displayAmount.targetCurrency)
        ) : (
          <span className="text-sm font-medium text-warning">
            Amount in {displayAmount.targetCurrency} unavailable
          </span>
        )}
      </div>
    </motion.div>
  );
}
