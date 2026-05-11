import { describe, expect, it } from 'vitest';
import { buildImportSuccessMessage } from '@/features/transactions/utils/messageBuilder';

describe('buildImportSuccessMessage', () => {
  it('builds a created-only import message', () => {
    expect(
      buildImportSuccessMessage({
        created: 12,
        duplicatesSkipped: 0,
        duplicatesImported: 0,
        filtersActive: false,
      }),
    ).toEqual({
      type: 'success',
      text: 'Successfully imported 12 transactions.',
    });
  });

  it('includes skipped duplicate count', () => {
    expect(
      buildImportSuccessMessage({
        created: 12,
        duplicatesSkipped: 3,
        duplicatesImported: 0,
        filtersActive: false,
      }).text,
    ).toBe('Successfully imported 12 transactions. Skipped 3 duplicates.');
  });

  it('includes imported duplicate count', () => {
    expect(
      buildImportSuccessMessage({
        created: 12,
        duplicatesSkipped: 3,
        duplicatesImported: 2,
        filtersActive: false,
      }).text,
    ).toBe('Successfully imported 12 transactions, including 2 duplicates. Skipped 3 duplicates.');
  });

  it('preserves the active filter warning', () => {
    expect(
      buildImportSuccessMessage({
        created: 1,
        duplicatesSkipped: 0,
        duplicatesImported: 0,
        filtersActive: true,
      }).text,
    ).toBe(
      'Successfully imported 1 transaction.  Some may be hidden by your current filters, [Clear filters] to see all.',
    );
  });
});
