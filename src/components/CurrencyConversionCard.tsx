// src/components/CurrencyConversionCard.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { DetailRow } from '@/components/DetailRow';
import { expandVariants, expandTransition } from '@/lib/animations';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowRightLeft, Banknote, Info } from 'lucide-react';
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
              <DetailRow
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
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Exchange Rate</p>
                    <p className="text-base">
                      1{' '}
                      {conversionInfo.sourceCurrency === 'USD'
                        ? 'USD'
                        : conversionInfo.targetCurrency}{' '}
                      = {conversionInfo.rate.toFixed(4)}{' '}
                      {conversionInfo.sourceCurrency === 'USD'
                        ? conversionInfo.targetCurrency
                        : 'USD'}
                    </p>
                    {conversionInfo.publishedDate && conversionInfo.rateDate && (
                      <p
                        className={`text-xs mt-1 ${
                          conversionInfo.usedFallbackRate ? 'text-warning' : 'text-success'
                        }`}
                      >
                        {conversionInfo.usedFallbackRate ? (
                          <>
                            Rate from {formatDate(conversionInfo.rateDate)} (nearest available)
                            <span className="block mt-0.5 text-muted-foreground">
                              FRED daily spot rate published on{' '}
                              {formatDate(conversionInfo.publishedDate)}
                            </span>
                          </>
                        ) : (
                          <>
                            FRED daily spot rate published on{' '}
                            {formatDate(conversionInfo.publishedDate)}
                          </>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
