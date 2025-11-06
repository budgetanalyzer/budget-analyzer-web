// src/pages/TransactionDetailPage.tsx
import { useParams, Link } from 'react-router';
import { motion, LayoutGroup } from 'framer-motion';
import { useTransaction } from '@/hooks/useTransactions';
import { useExchangeRatesMap } from '@/hooks/useCurrencies';
import { fadeInVariants, fadeTransition, layoutTransition } from '@/lib/animations';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { BackButton } from '@/components/BackButton';
import { IconLabel } from '@/components/IconLabel';
import { CurrencyConversionCard } from '@/components/CurrencyConversionCard';
import { TransactionMetadataCard } from '@/components/TransactionMetadataCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/currency';
import { formatLocalDate } from '@/lib/dateUtils';
import { Calendar, Banknote, Building2, CreditCard, FileText, Currency } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { convertCurrency, findNearestExchangeRate } from '@/lib/currency';
import { useMemo } from 'react';

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const transactionId = Number(id);
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);

  const { data: transaction, isLoading, error, refetch } = useTransaction(transactionId);

  // Fetch exchange rates and build map for currency conversion
  const { exchangeRatesMap } = useExchangeRatesMap();

  // Calculate conversion info
  const conversionInfo = useMemo(() => {
    if (!transaction) return null;

    const sourceCurrency = transaction.currencyIsoCode;
    const needsConversion = sourceCurrency !== displayCurrency;

    if (!needsConversion) {
      return { needsConversion: false as const };
    }

    const convertedAmount = convertCurrency(
      transaction.amount,
      transaction.date,
      sourceCurrency,
      displayCurrency,
      exchangeRatesMap,
    );

    // Get the full exchange rate response from the map (or nearest available)
    const exchangeRateResponse = findNearestExchangeRate(transaction.date, exchangeRatesMap);

    // State 3: Missing rate - we had to use a rate from a completely different date
    const usedFallbackRate = exchangeRateResponse?.date !== transaction.date;

    return {
      needsConversion: true as const,
      convertedAmount,
      rate: exchangeRateResponse?.rate,
      publishedDate: exchangeRateResponse?.publishedDate,
      rateDate: exchangeRateResponse?.date,
      usedFallbackRate,
      sourceCurrency,
      targetCurrency: displayCurrency,
    };
  }, [transaction, displayCurrency, exchangeRatesMap]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" text="Loading transaction details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <BackButton />
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="w-full max-w-md">
            <ErrorBanner error={error} onRetry={() => refetch()} />
          </div>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return null;
  }

  return (
    <motion.div
      variants={fadeInVariants}
      initial="initial"
      animate="animate"
      transition={fadeTransition}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <BackButton />
        <Link to="/">
          <Button variant="outline">View All</Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transaction Details</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          variants={fadeInVariants}
          initial="initial"
          animate="animate"
          transition={fadeTransition}
        >
          <Card>
            <CardHeader>
              <CardTitle>Transaction Information</CardTitle>
              <CardDescription>Core transaction details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Banknote className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Amount</p>
                  <p
                    className={`text-2xl font-bold ${
                      transaction.type === 'CREDIT'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-foreground'
                    }`}
                  >
                    {formatCurrency(transaction.amount, transaction.currencyIsoCode)}
                  </p>
                </div>
                <Badge variant={transaction.type === 'CREDIT' ? 'success' : 'secondary'}>
                  {transaction.type}
                </Badge>
              </div>

              <IconLabel icon={FileText} label="Description" value={transaction.description} />

              <IconLabel
                icon={Calendar}
                label="Transaction Date"
                value={formatLocalDate(transaction.date)}
              />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={fadeInVariants}
          initial="initial"
          animate="animate"
          transition={fadeTransition}
        >
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Bank and account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <IconLabel icon={Building2} label="Bank Name" value={transaction.bankName} />

              <IconLabel
                icon={CreditCard}
                label="Account ID"
                value={transaction.accountId}
                valueClassName="text-base font-mono"
              />

              <IconLabel icon={Currency} label="Currency" value={transaction.currencyIsoCode} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Currency Conversion Card - Only show if conversion is needed */}
      <LayoutGroup>
        <CurrencyConversionCard
          conversionInfo={conversionInfo}
          originalAmount={transaction.amount}
          transactionType={transaction.type}
        />

        <motion.div
          layout
          variants={fadeInVariants}
          initial="initial"
          animate="animate"
          transition={{ ...fadeTransition, layout: layoutTransition }}
        >
          <TransactionMetadataCard
            createdAt={transaction.createdAt}
            updatedAt={transaction.updatedAt}
          />
        </motion.div>
      </LayoutGroup>
    </motion.div>
  );
}
