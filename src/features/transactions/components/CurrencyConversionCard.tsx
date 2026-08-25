// src/components/CurrencyConversionCard.tsx
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { IconLabel } from '@/components/IconLabel';
import { ExchangeRateInfo } from '@/features/transactions/components/ExchangeRateInfo';
import { expandVariants, expandTransition } from '@/lib/animations';
import { formatCurrency } from '@/utils/currency';
import { ArrowRightLeft, Banknote } from 'lucide-react';
import type { TransactionType } from '@/types/transaction';
import type { DisplayAmount } from '@/types/displayAmount';

interface CurrencyConversionCardProps {
  displayAmount: DisplayAmount;
  transactionType: TransactionType;
}

export function CurrencyConversionCard({
  displayAmount,
  transactionType,
}: CurrencyConversionCardProps) {
  const needsConversion = displayAmount.sourceCurrency !== displayAmount.targetCurrency;
  const amountColorClass =
    transactionType === 'CREDIT' ? 'text-green-600 dark:text-green-400' : 'text-foreground';

  return (
    <AnimatePresence initial={false}>
      {needsConversion && (
        <motion.div
          key="currency-conversion"
          layout
          variants={expandVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={expandTransition}
        >
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                <CardTitle>Currency Conversion</CardTitle>
              </div>
              <CardDescription>
                Selected-currency amount in {displayAmount.targetCurrency}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <IconLabel
                icon={Banknote}
                label="Native Amount"
                value={`${formatCurrency(displayAmount.sourceMagnitude, displayAmount.sourceCurrency)} ${displayAmount.sourceCurrency}`}
                valueClassName="text-xl font-semibold"
              />

              <div className="flex items-start gap-3">
                <ArrowRightLeft className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Selected Amount ({displayAmount.targetCurrency})
                  </p>
                  {displayAmount.available ? (
                    <p className={`text-2xl font-bold ${amountColorClass}`}>
                      {formatCurrency(displayAmount.value, displayAmount.targetCurrency)}
                    </p>
                  ) : (
                    <p className="text-base font-semibold text-warning">
                      Conversion to {displayAmount.targetCurrency} unavailable
                    </p>
                  )}
                </div>
              </div>

              {displayAmount.available &&
                displayAmount.rateLegs.map((rateLeg) => (
                  <ExchangeRateInfo
                    key={`${rateLeg.kind}-${rateLeg.exchangeRate.targetCurrency}`}
                    rateLeg={rateLeg}
                  />
                ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
