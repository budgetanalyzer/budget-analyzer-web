import type { ExchangeRateResponse } from '@/types/currency';

export type DisplayAmountUnavailableReason =
  | 'MISSING_SOURCE_RATE'
  | 'INVALID_SOURCE_RATE'
  | 'MISSING_TARGET_RATE'
  | 'INVALID_TARGET_RATE'
  | 'UNSUPPORTED_CURRENCY_PRECISION';

export type DisplayAmountRateLeg =
  | {
      kind: 'SOURCE_TO_USD';
      exchangeRate: ExchangeRateResponse;
    }
  | {
      kind: 'USD_TO_TARGET';
      exchangeRate: ExchangeRateResponse;
    };

export type DisplayAmountRateLegs =
  | readonly []
  | readonly [DisplayAmountRateLeg]
  | readonly [DisplayAmountRateLeg, DisplayAmountRateLeg];

export interface AvailableDisplayAmount {
  available: true;
  sourceMagnitude: number;
  sourceCurrency: string;
  targetCurrency: string;
  minorUnitCount: number;
  value: number;
  rateLegs: DisplayAmountRateLegs;
}

export interface UnavailableDisplayAmount {
  available: false;
  sourceMagnitude: number;
  sourceCurrency: string;
  targetCurrency: string;
  reason: DisplayAmountUnavailableReason;
}

export type DisplayAmount = AvailableDisplayAmount | UnavailableDisplayAmount;
