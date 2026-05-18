import { describe, expect, it } from 'vitest';
import { buildAnalyticsDrilldownUrl } from '@/utils/navigation';

describe('buildAnalyticsDrilldownUrl', () => {
  it('builds all-transaction analytics drilldowns to the transactions page', () => {
    expect(
      buildAnalyticsDrilldownUrl({
        scope: 'all',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        returnTo: '/analytics?scope=all&viewMode=monthly&transactionType=debit&year=2026',
        breadcrumbLabel: 'Jan 2026',
      }),
    ).toBe(
      '/?dateFrom=2026-01-01&dateTo=2026-01-31&returnTo=%2Fanalytics%3Fscope%3Dall%26viewMode%3Dmonthly%26transactionType%3Ddebit%26year%3D2026&breadcrumbLabel=Jan%202026',
    );
  });

  it('builds view-scoped analytics drilldowns to the view detail page', () => {
    expect(
      buildAnalyticsDrilldownUrl({
        scope: 'view',
        viewId: 'view-123',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
        returnTo: '/analytics?scope=view&viewId=view-123&viewMode=yearly&transactionType=credit',
        breadcrumbLabel: '2026',
      }),
    ).toBe(
      '/views/view-123?dateFrom=2026-01-01&dateTo=2026-12-31&returnTo=%2Fanalytics%3Fscope%3Dview%26viewId%3Dview-123%26viewMode%3Dyearly%26transactionType%3Dcredit&breadcrumbLabel=2026',
    );
  });
});
