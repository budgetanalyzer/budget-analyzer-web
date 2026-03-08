// src/components/MissingExchangeRatesBanner.tsx
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fadeVariants, fadeTransition } from '@/lib/animations';

export interface MissingExchangeRatesBannerProps {
  disabledCurrencies: string[];
  pendingCurrencies: string[];
  onRefresh: () => void;
  isRefreshing: boolean;
}

/**
 * Banner component for displaying warnings about missing exchange rates.
 * - Disabled currencies: Currencies that are disabled in admin - no refresh button
 * - Pending currencies: Currencies enabled but rates not yet imported - with refresh button
 */
export function MissingExchangeRatesBanner({
  disabledCurrencies,
  pendingCurrencies,
  onRefresh,
  isRefreshing,
}: MissingExchangeRatesBannerProps) {
  const hasDisabled = disabledCurrencies.length > 0;
  const hasPending = pendingCurrencies.length > 0;

  if (!hasDisabled && !hasPending) {
    return null;
  }

  const formatCurrencyList = (currencies: string[]) => {
    if (currencies.length === 1) return currencies[0];
    if (currencies.length === 2) return `${currencies[0]} and ${currencies[1]}`;
    const last = currencies[currencies.length - 1];
    const rest = currencies.slice(0, -1);
    return `${rest.join(', ')}, and ${last}`;
  };

  return (
    <motion.div
      key="missing-exchange-rates-banner"
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={fadeTransition}
      className="flex flex-col gap-2 rounded-lg bg-warning/15 px-4 py-3 text-warning"
    >
      {hasDisabled && (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">
            {formatCurrencyList(disabledCurrencies)}{' '}
            {disabledCurrencies.length === 1 ? 'is' : 'are'} disabled. Amounts shown in original
            currency.
          </span>
        </div>
      )}
      {hasPending && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span className="font-medium">
              Exchange rates for {formatCurrencyList(pendingCurrencies)}{' '}
              {pendingCurrencies.length === 1 ? 'is' : 'are'} being imported. Amounts shown in
              original currency.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex-shrink-0"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      )}
    </motion.div>
  );
}
