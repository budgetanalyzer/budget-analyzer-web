// src/components/CurrencyConversionCard.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { IconLabel } from '@/components/IconLabel';
import { ExchangeRateInfo } from '@/components/ExchangeRateInfo';
import { expandVariants, expandTransition } from '@/lib/animations';
import { formatCurrency } from '@/lib/currency';
import { ArrowRightLeft, Banknote } from 'lucide-react';
import { TransactionType } from '@/types/transaction';

type ConversionInfo =
  | {
      needsConversion: false;
    }
  | {
      needsConversion: true;
      convertedAmount: number;
      rate?: number;
      publishedDate?: string;
      rateDate?: string;
      usedFallbackRate: boolean;
      sourceCurrency: string;
      targetCurrency: string;
    };

interface CurrencyConversionCardProps {
  conversionInfo: ConversionInfo | null;
  originalAmount: number;
  transactionType: TransactionType;
}

export function CurrencyConversionCard({
  conversionInfo,
  originalAmount,
  transactionType,
}: CurrencyConversionCardProps) {
  const getAmountColorClass = (type: TransactionType) => {
    return type === 'CREDIT' ? 'text-green-600 dark:text-green-400' : 'text-foreground';
  };

  return (
    <AnimatePresence initial={false}>
      {conversionInfo?.needsConversion && (
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
                Converted to {conversionInfo.targetCurrency} using the FRED daily spot rate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <IconLabel
                icon={Banknote}
                label="Original Transaction"
                value={formatCurrency(originalAmount, conversionInfo.sourceCurrency)}
                valueClassName="text-xl font-semibold"
              />

              <div className="flex items-start gap-3">
                <ArrowRightLeft className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Converted Amount ({conversionInfo.targetCurrency})
                  </p>
                  <p className={`text-2xl font-bold ${getAmountColorClass(transactionType)}`}>
                    {formatCurrency(conversionInfo.convertedAmount, conversionInfo.targetCurrency)}
                  </p>
                </div>
              </div>

              {conversionInfo.rate && (
                <ExchangeRateInfo
                  rate={conversionInfo.rate}
                  sourceCurrency={conversionInfo.sourceCurrency}
                  targetCurrency={conversionInfo.targetCurrency}
                  publishedDate={conversionInfo.publishedDate}
                  rateDate={conversionInfo.rateDate}
                  usedFallbackRate={conversionInfo.usedFallbackRate}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
