import { describe, expect, it } from 'vitest';
import {
  buildAdminTxnSearchParams,
  clearAdminTxnFilters,
  parseAdminTxnQuery,
} from '@/features/admin/transactions/utils/urlState';

describe('admin transaction URL state', () => {
  it('parses signed finite amount bounds and canonicalizes the independent currency criterion', () => {
    const query = parseAdminTxnQuery(
      new URLSearchParams('currency=%20eur%20&minAmount=-25.5&maxAmount=100'),
    );

    expect(query).toMatchObject({
      currencyIsoCode: 'EUR',
      minAmount: -25.5,
      maxAmount: 100,
    });
  });

  it('keeps currency-only and amount-only searches independent', () => {
    expect(parseAdminTxnQuery(new URLSearchParams('currency=gbp'))).toMatchObject({
      currencyIsoCode: 'GBP',
      minAmount: undefined,
      maxAmount: undefined,
    });
    expect(parseAdminTxnQuery(new URLSearchParams('minAmount=-10'))).toMatchObject({
      currencyIsoCode: undefined,
      minAmount: -10,
    });
  });

  it('drops non-finite numeric parameters', () => {
    const query = parseAdminTxnQuery(
      new URLSearchParams('minAmount=Infinity&maxAmount=-Infinity&page=Infinity&size=Infinity'),
    );

    expect(query).toMatchObject({
      page: 0,
      size: 50,
      minAmount: undefined,
      maxAmount: undefined,
    });
  });

  it('serializes canonical currency without changing signed bounds', () => {
    const params = buildAdminTxnSearchParams({
      page: 0,
      size: 50,
      sort: ['date,DESC', 'id,DESC'],
      currencyIsoCode: ' eur ',
      minAmount: -25.5,
      maxAmount: 100,
    });

    expect(params.get('currency')).toBe('EUR');
    expect(params.get('minAmount')).toBe('-25.5');
    expect(params.get('maxAmount')).toBe('100');
  });

  it('clears currency and amount filters together with all other filters', () => {
    const params = clearAdminTxnFilters({
      page: 3,
      size: 100,
      sort: ['amount,ASC', 'id,DESC'],
      currencyIsoCode: 'EUR',
      minAmount: -10,
      description: 'coffee',
    });

    expect(params.get('currency')).toBeNull();
    expect(params.get('minAmount')).toBeNull();
    expect(params.get('q')).toBeNull();
    expect(params.get('size')).toBe('100');
    expect(params.getAll('sort')).toEqual(['amount,ASC', 'id,DESC']);
  });
});
