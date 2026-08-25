// src/components/ExchangeRateInfo.tsx
import { Info } from 'lucide-react';
import type { DisplayAmountRateLeg } from '@/types/displayAmount';
import { formatLocalDate } from '@/utils/dates';

interface ExchangeRateInfoProps {
  rateLeg: DisplayAmountRateLeg;
}

export function ExchangeRateInfo({ rateLeg }: ExchangeRateInfoProps) {
  const { exchangeRate } = rateLeg;
  const isCarryForward = exchangeRate.publishedDate < exchangeRate.date;
  const legLabel =
    rateLeg.kind === 'SOURCE_TO_USD'
      ? `${exchangeRate.targetCurrency} to USD`
      : `USD to ${exchangeRate.targetCurrency}`;

  return (
    <div className="flex items-start gap-3">
      <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{legLabel} exchange-rate leg</p>
        <p className="text-base">
          1 {exchangeRate.baseCurrency} = {exchangeRate.rate.toFixed(4)}{' '}
          {exchangeRate.targetCurrency}
        </p>
        <p className="text-xs text-muted-foreground">
          Effective for transaction date {formatLocalDate(exchangeRate.date)} · Published{' '}
          {formatLocalDate(exchangeRate.publishedDate)}
        </p>
        {isCarryForward && (
          <p className="text-xs text-warning">
            Currency Service carried forward the prior publication for a weekend or holiday.
          </p>
        )}
      </div>
    </div>
  );
}
