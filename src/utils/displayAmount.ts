import type { ExchangeRateResponse } from '@/types/currency';
import type {
  AvailableDisplayAmount,
  DisplayAmount,
  DisplayAmountRateLegs,
  DisplayAmountUnavailableReason,
  UnavailableDisplayAmount,
} from '@/types/displayAmount';
import type { Transaction } from '@/types/transaction';

type ExchangeRateMap = Map<string, Map<string, ExchangeRateResponse>>;

interface DisplayAmountContext {
  sourceMagnitude: number;
  sourceCurrency: string;
  targetCurrency: string;
}

function unavailableDisplayAmount(
  context: DisplayAmountContext,
  reason: DisplayAmountUnavailableReason,
): UnavailableDisplayAmount {
  return {
    available: false,
    ...context,
    reason,
  };
}

function availableDisplayAmount(
  context: DisplayAmountContext,
  minorUnitCount: number,
  value: number,
  rateLegs: DisplayAmountRateLegs,
): AvailableDisplayAmount {
  return {
    available: true,
    ...context,
    minorUnitCount,
    value: quantizeCurrencyAmount(value, minorUnitCount),
    rateLegs,
  };
}

function isValidRate(rate: ExchangeRateResponse, date: string, targetCurrency: string): boolean {
  return (
    rate.baseCurrency === 'USD' &&
    rate.targetCurrency === targetCurrency &&
    rate.date === date &&
    Number.isFinite(rate.rate) &&
    rate.rate > 0
  );
}

/**
 * Resolve the ISO 4217 minor-unit count used by the runtime currency formatter.
 */
export function getCurrencyMinorUnitCount(currencyIsoCode: string): number | null {
  try {
    const { maximumFractionDigits } = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyIsoCode,
    }).resolvedOptions();

    return typeof maximumFractionDigits === 'number' && Number.isInteger(maximumFractionDigits)
      ? maximumFractionDigits
      : null;
  } catch {
    return null;
  }
}

/**
 * Quantize a currency value once at its display precision.
 */
export function quantizeCurrencyAmount(value: number, minorUnitCount: number): number {
  const factor = 10 ** minorUnitCount;
  const scaledValue = value * factor;
  const roundingTolerance = Number.EPSILON * Math.max(1, Math.abs(scaledValue));

  return Math.round(scaledValue + roundingTolerance) / factor;
}

/**
 * Look up only the rate entry keyed by the requested LocalDate and currency.
 */
export function findExactExchangeRate(
  date: string,
  targetCurrency: string,
  ratesMap: ExchangeRateMap,
): ExchangeRateResponse | null {
  return ratesMap.get(date)?.get(targetCurrency) ?? null;
}

/**
 * Project one stored transaction into its positive, quantized display magnitude.
 */
export function projectDisplayAmount(
  transaction: Pick<Transaction, 'amount' | 'currencyIsoCode' | 'date'>,
  targetCurrency: string,
  ratesMap: ExchangeRateMap,
): DisplayAmount {
  const context: DisplayAmountContext = {
    sourceMagnitude: Math.abs(transaction.amount),
    sourceCurrency: transaction.currencyIsoCode,
    targetCurrency,
  };
  const minorUnitCount = getCurrencyMinorUnitCount(targetCurrency);

  if (minorUnitCount === null) {
    return unavailableDisplayAmount(context, 'UNSUPPORTED_CURRENCY_PRECISION');
  }

  if (transaction.currencyIsoCode === targetCurrency) {
    return availableDisplayAmount(context, minorUnitCount, context.sourceMagnitude, []);
  }

  if (transaction.currencyIsoCode === 'USD') {
    const targetRate = findExactExchangeRate(transaction.date, targetCurrency, ratesMap);
    if (!targetRate) {
      return unavailableDisplayAmount(context, 'MISSING_TARGET_RATE');
    }
    if (!isValidRate(targetRate, transaction.date, targetCurrency)) {
      return unavailableDisplayAmount(context, 'INVALID_TARGET_RATE');
    }

    return availableDisplayAmount(
      context,
      minorUnitCount,
      context.sourceMagnitude * targetRate.rate,
      [{ kind: 'USD_TO_TARGET', exchangeRate: targetRate }],
    );
  }

  const sourceRate = findExactExchangeRate(transaction.date, transaction.currencyIsoCode, ratesMap);
  if (!sourceRate) {
    return unavailableDisplayAmount(context, 'MISSING_SOURCE_RATE');
  }
  if (!isValidRate(sourceRate, transaction.date, transaction.currencyIsoCode)) {
    return unavailableDisplayAmount(context, 'INVALID_SOURCE_RATE');
  }

  if (targetCurrency === 'USD') {
    return availableDisplayAmount(
      context,
      minorUnitCount,
      context.sourceMagnitude / sourceRate.rate,
      [{ kind: 'SOURCE_TO_USD', exchangeRate: sourceRate }],
    );
  }

  const targetRate = findExactExchangeRate(transaction.date, targetCurrency, ratesMap);
  if (!targetRate) {
    return unavailableDisplayAmount(context, 'MISSING_TARGET_RATE');
  }
  if (!isValidRate(targetRate, transaction.date, targetCurrency)) {
    return unavailableDisplayAmount(context, 'INVALID_TARGET_RATE');
  }

  return availableDisplayAmount(
    context,
    minorUnitCount,
    (context.sourceMagnitude / sourceRate.rate) * targetRate.rate,
    [
      { kind: 'SOURCE_TO_USD', exchangeRate: sourceRate },
      { kind: 'USD_TO_TARGET', exchangeRate: targetRate },
    ],
  );
}
