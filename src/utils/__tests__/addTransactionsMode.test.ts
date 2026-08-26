import { describe, expect, it } from 'vitest';
import {
  buildAddTransactionsModeUrl,
  hasAddTransactionsModeParams,
  parseAddTransactionsMode,
  removeAddTransactionsModeParams,
} from '@/utils/addTransactionsMode';

const viewId = '11111111-1111-4111-8111-111111111111';
const returnTo = `/views/${viewId}?q=coffee`;

describe('add-transactions URL mode', () => {
  it('builds and parses a mode while preserving only ordinary transaction filters', () => {
    const sourceSearchParams = new URLSearchParams(
      'q=coffee&dateFrom=2026-01-01&amountCurrency=USD&returnTo=%2Fanalytics&unexpected=yes',
    );

    const url = buildAddTransactionsModeUrl({ viewId, returnTo, sourceSearchParams });
    expect(url).not.toBeNull();

    const searchParams = new URL(url!, 'https://budgetanalyzer.invalid').searchParams;
    expect(parseAddTransactionsMode(searchParams)).toEqual({ viewId, returnTo });
    expect(searchParams.get('q')).toBe('coffee');
    expect(searchParams.get('dateFrom')).toBe('2026-01-01');
    expect(searchParams.get('amountCurrency')).toBe('USD');
    expect(searchParams.has('unexpected')).toBe(false);
    expect(searchParams.has('returnTo')).toBe(false);
  });

  it.each([
    ['missing return target', `addToView=${viewId}`],
    [
      'malformed view ID',
      `addToView=view-1&addToViewReturnTo=${encodeURIComponent('/views/view-1')}`,
    ],
    [
      'external return target',
      `addToView=${viewId}&addToViewReturnTo=${encodeURIComponent('https://example.com')}`,
    ],
    [
      'protocol-relative return target',
      `addToView=${viewId}&addToViewReturnTo=${encodeURIComponent('//example.com/views/' + viewId)}`,
    ],
    [
      'different view return target',
      `addToView=${viewId}&addToViewReturnTo=${encodeURIComponent('/views/22222222-2222-4222-8222-222222222222')}`,
    ],
    [
      'recursive add-mode return target',
      `addToView=${viewId}&addToViewReturnTo=${encodeURIComponent(`/views/${viewId}?addToView=${viewId}`)}`,
    ],
  ])('rejects a %s', (_label, query) => {
    expect(parseAddTransactionsMode(new URLSearchParams(query))).toBeNull();
  });

  it('removes both mode parameters without disturbing transaction filters', () => {
    const params = new URLSearchParams({
      q: 'coffee',
      addToView: viewId,
      addToViewReturnTo: returnTo,
    });

    expect(hasAddTransactionsModeParams(params)).toBe(true);
    expect(removeAddTransactionsModeParams(params).toString()).toBe('q=coffee');
  });

  it('refuses to build invalid mode URLs', () => {
    expect(buildAddTransactionsModeUrl({ viewId: 'view-1', returnTo: '/views/view-1' })).toBeNull();
    expect(buildAddTransactionsModeUrl({ viewId, returnTo: 'https://example.com' })).toBeNull();
  });
});
