// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatLocalDate } from './dateUtils';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}

export interface ExchangeRateDisplayInfo {
  rateText: string;
  dateInfo: {
    text: string;
    isFallback: boolean;
  } | null;
}

export interface ExchangeRateData {
  rate: number;
  sourceCurrency: string;
  targetCurrency: string;
  publishedDate?: string;
  rateDate?: string;
  usedFallbackRate: boolean;
}

/**
 * Formats exchange rate data for display in the UI.
 * Handles currency pair display, date formatting, and fallback rate messaging.
 *
 * @param data - Exchange rate data from the API
 * @returns Formatted display information including rate text and date info
 *
 * @example
 * // USD to THB conversion
 * formatExchangeRateDisplay({
 *   rate: 33.5,
 *   sourceCurrency: 'USD',
 *   targetCurrency: 'THB',
 *   publishedDate: '2025-07-01',
 *   rateDate: '2025-07-01',
 *   usedFallbackRate: false
 * })
 * // Returns:
 * // {
 * //   rateText: '1 USD = 33.5000 THB',
 * //   dateInfo: {
 * //     text: 'FRED daily spot rate published on Jul 1, 2025',
 * //     isFallback: false
 * //   }
 * // }
 *
 * @example
 * // THB to USD conversion with fallback rate
 * formatExchangeRateDisplay({
 *   rate: 0.0298,
 *   sourceCurrency: 'THB',
 *   targetCurrency: 'USD',
 *   publishedDate: '2025-06-28',
 *   rateDate: '2025-06-27',
 *   usedFallbackRate: true
 * })
 * // Returns:
 * // {
 * //   rateText: '1 THB = 0.0298 USD',
 * //   dateInfo: {
 * //     text: 'Rate from Jun 27, 2025 (nearest available)\nFRED daily spot rate published on Jun 28, 2025',
 * //     isFallback: true
 * //   }
 * // }
 */
export function formatExchangeRateDisplay(data: ExchangeRateData): ExchangeRateDisplayInfo {
  // Determine which currency to show as base (always show rate as "1 X = Y Z")
  const baseCurrency = data.sourceCurrency === 'USD' ? 'USD' : data.targetCurrency;
  const quoteCurrency = data.sourceCurrency === 'USD' ? data.targetCurrency : 'USD';

  // Format the rate text
  const rateText = `1 ${baseCurrency} = ${data.rate.toFixed(4)} ${quoteCurrency}`;

  // Build date info if dates are available
  let dateInfo: ExchangeRateDisplayInfo['dateInfo'] = null;

  if (data.publishedDate && data.rateDate) {
    const formattedPublishedDate = formatLocalDate(data.publishedDate);

    if (data.usedFallbackRate) {
      const formattedRateDate = formatLocalDate(data.rateDate);
      dateInfo = {
        text: `Rate from ${formattedRateDate} (nearest available)\nFRED daily spot rate published on ${formattedPublishedDate}`,
        isFallback: true,
      };
    } else {
      dateInfo = {
        text: `FRED daily spot rate published on ${formattedPublishedDate}`,
        isFallback: false,
      };
    }
  }

  return { rateText, dateInfo };
}
