// src/components/ExchangeRateInfo.tsx
import { Info } from 'lucide-react';
import { formatLocalDate } from '@/utils/dates';

interface ExchangeRateInfoProps {
  rate: number;
  sourceCurrency: string;
  targetCurrency: string;
  rateDate?: string;
  usedFallbackRate: boolean;
}

/**
 * Displays exchange rate information with formatted currency pair and date details.
 * Handles both current and fallback exchange rates with appropriate styling.
 */
export function ExchangeRateInfo({
  rate,
  sourceCurrency,
  targetCurrency,
  rateDate,
  usedFallbackRate,
}: ExchangeRateInfoProps) {
  // Determine which currency to show as base (always show rate as "1 X = Y Z")
  const baseCurrency = sourceCurrency === 'USD' ? 'USD' : targetCurrency;
  const quoteCurrency = sourceCurrency === 'USD' ? targetCurrency : 'USD';

  // Format the rate text
  const rateText = `1 ${baseCurrency} = ${rate.toFixed(4)} ${quoteCurrency}`;

  return (
    <div className="flex items-start gap-3">
      <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-muted-foreground">Exchange Rate</p>
        <p className="text-base">{rateText}</p>
        {rateDate && (
          <p className={`text-xs mt-1 ${usedFallbackRate ? 'text-warning' : 'text-success'}`}>
            {usedFallbackRate ? (
              <>Rate from {formatLocalDate(rateDate)} (nearest available)</>
            ) : (
              <>FRED daily spot rate for {formatLocalDate(rateDate)}</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
