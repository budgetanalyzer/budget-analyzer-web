import { describe, expect, it } from 'vitest';
import {
  MISSING_TRANSACTION_METADATA,
  deriveTransactionMetadataFilterOptions,
  formatTransactionMetadata,
} from '@/utils/transactionMetadata';

describe('transaction metadata', () => {
  it('uses the missing-value marker for nullish and blank display values', () => {
    expect(formatTransactionMetadata(undefined)).toBe(MISSING_TRANSACTION_METADATA);
    expect(formatTransactionMetadata(null)).toBe(MISSING_TRANSACTION_METADATA);
    expect(formatTransactionMetadata('')).toBe(MISSING_TRANSACTION_METADATA);
    expect(formatTransactionMetadata('   ')).toBe(MISSING_TRANSACTION_METADATA);
    expect(formatTransactionMetadata(' Example Bank ')).toBe(' Example Bank ');
  });

  it('derives sorted unique filter options without changing meaningful values', () => {
    expect(
      deriveTransactionMetadataFilterOptions([
        'Second Bank',
        undefined,
        'Example Bank',
        null,
        '',
        '   ',
        'Second Bank',
      ]),
    ).toEqual(['Example Bank', 'Second Bank']);
  });
});
