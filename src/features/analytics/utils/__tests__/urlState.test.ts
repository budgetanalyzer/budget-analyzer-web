import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_SCOPES,
  TRANSACTION_TYPES,
  VIEW_MODES,
  buildAnalyticsReturnUrl,
  parseAnalyticsSearchParams,
} from '@/features/analytics/utils/urlState';

describe('parseAnalyticsSearchParams', () => {
  it('defaults missing analytics params to all-scope monthly debit analytics', () => {
    expect(parseAnalyticsSearchParams(new URLSearchParams())).toEqual({
      scope: ANALYTICS_SCOPES.ALL,
      viewId: undefined,
      viewMode: VIEW_MODES.MONTHLY,
      transactionType: TRANSACTION_TYPES.DEBIT,
      year: undefined,
    });
  });

  it('parses a valid view-scoped analytics URL state', () => {
    const params = new URLSearchParams(
      'scope=view&viewId=view-123&viewMode=yearly&transactionType=credit&year=2026',
    );

    expect(parseAnalyticsSearchParams(params)).toEqual({
      scope: ANALYTICS_SCOPES.VIEW,
      viewId: 'view-123',
      viewMode: VIEW_MODES.YEARLY,
      transactionType: TRANSACTION_TYPES.CREDIT,
      year: 2026,
    });
  });

  it('falls back to all scope when scope=view has no viewId', () => {
    const params = new URLSearchParams('scope=view&viewMode=monthly&transactionType=debit');

    expect(parseAnalyticsSearchParams(params)).toMatchObject({
      scope: ANALYTICS_SCOPES.ALL,
      viewId: undefined,
    });
  });
});

describe('buildAnalyticsReturnUrl', () => {
  it('builds an explicit all-transaction analytics return URL', () => {
    expect(
      buildAnalyticsReturnUrl({
        scope: ANALYTICS_SCOPES.ALL,
        viewMode: VIEW_MODES.MONTHLY,
        transactionType: TRANSACTION_TYPES.DEBIT,
        year: 2026,
      }),
    ).toBe('/analytics?scope=all&viewMode=monthly&transactionType=debit&year=2026');
  });

  it('preserves view scope and viewId in analytics return URLs', () => {
    expect(
      buildAnalyticsReturnUrl({
        scope: ANALYTICS_SCOPES.VIEW,
        viewId: 'view-123',
        viewMode: VIEW_MODES.YEARLY,
        transactionType: TRANSACTION_TYPES.CREDIT,
      }),
    ).toBe('/analytics?scope=view&viewId=view-123&viewMode=yearly&transactionType=credit');
  });
});
