// src/pages/TransactionDetailPage.tsx
import { useParams, useNavigate, Link } from 'react-router';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useTransaction } from '@/hooks/useTransactions';
import { useExchangeRatesMap } from '@/hooks/useCurrencies';
import {
  fadeInVariants,
  fadeTransition,
  expandVariants,
  expandTransition,
  layoutTransition,
} from '@/lib/animations';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  Calendar,
  Banknote,
  Building2,
  CreditCard,
  FileText,
  Clock,
  ArrowRightLeft,
  Info,
  Currency,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAppSelector } from '@/store/hooks';
import { convertCurrency, findNearestExchangeRate } from '@/lib/currency';
import { useMemo } from 'react';

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
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
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Transactions
        </Button>
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

              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-base">{transaction.description}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Transaction Date</p>
                  <p className="text-base">{formatDate(transaction.date)}</p>
                </div>
              </div>
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
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Bank Name</p>
                  <p className="text-base">{transaction.bankName}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Account ID</p>
                  <p className="text-base font-mono">{transaction.accountId}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Currency className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Currency</p>
                  <p className="text-base">{transaction.currencyIsoCode}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Currency Conversion Card - Only show if conversion is needed */}
      <LayoutGroup>
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
                  <div className="flex items-start gap-3">
                    <Banknote className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Original Transaction
                      </p>
                      <p className="text-xl font-semibold">
                        {formatCurrency(transaction.amount, conversionInfo.sourceCurrency)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <ArrowRightLeft className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        Converted Amount ({conversionInfo.targetCurrency})
                      </p>
                      <p
                        className={`text-2xl font-bold ${
                          transaction.type === 'CREDIT'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-foreground'
                        }`}
                      >
                        {formatCurrency(
                          conversionInfo.convertedAmount,
                          conversionInfo.targetCurrency,
                        )}
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

        <motion.div
          layout
          variants={fadeInVariants}
          initial="initial"
          animate="animate"
          transition={{ ...fadeTransition, layout: layoutTransition }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
              <CardDescription>System timestamps and tracking information</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Created At</p>
                  <p className="text-base">{format(new Date(transaction.createdAt), 'PPpp')}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                  <p className="text-base">{format(new Date(transaction.updatedAt), 'PPpp')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </LayoutGroup>
    </motion.div>
  );
}
