import { describe, expect, it } from 'vitest';
import { ApiError } from '@/types/apiError';
import { formatApiError, formatFieldErrors, getErrorMessage } from '@/utils/errorMessages';

describe('error message utilities', () => {
  it.each([
    ['MISSING_ORIGINAL_FILENAME', 'The uploaded file must include a filename.'],
    ['BATCH_IMPORT_NO_TRANSACTIONS_CREATED', 'All submitted rows were skipped as duplicates.'],
    [
      'PREVIEW_IMPORT_TOKEN_INVALID',
      'This preview has expired or is no longer valid. Please preview the file again.',
    ],
    ['PREVIEW_IMPORT_TOKEN_EXPIRED', 'This preview has expired. Please preview the file again.'],
    ['CURRENCY_NOT_ENABLED', 'This currency is not enabled for exchange rate data'],
  ])('maps %s to the user-facing message', (code, message) => {
    expect(getErrorMessage(code)).toBe(message);
  });

  it('uses fallback messages for unknown or missing 422 codes', () => {
    expect(getErrorMessage('UNKNOWN_CODE', 'Server fallback')).toBe('Server fallback');
    expect(getErrorMessage(undefined, 'Server fallback')).toBe('Server fallback');
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred. Please try again.');
  });

  it('formats 422 import review errors with mapped messages', () => {
    const error = new ApiError(422, {
      type: 'APPLICATION_ERROR',
      message: 'Technical backend message',
      code: 'PREVIEW_IMPORT_TOKEN_EXPIRED',
    });

    expect(formatApiError(error, 'Failed to import transactions')).toBe(
      'This preview has expired. Please preview the file again.',
    );
  });

  it('formats non-422 API errors with the server message', () => {
    const error = new ApiError(404, {
      type: 'NOT_FOUND',
      message: 'Transaction not found',
    });

    expect(formatApiError(error, 'Failed to load transaction')).toBe('Transaction not found');
  });

  it('formats non-API errors with their message or default fallback', () => {
    expect(formatApiError(new Error('Network Error'), 'Request failed')).toBe('Network Error');
    expect(formatApiError(new Error(''), 'Request failed')).toBe('Request failed');
  });

  it('formats field-level validation errors for display', () => {
    expect(formatFieldErrors(undefined)).toBeUndefined();
    expect(formatFieldErrors([])).toBeUndefined();
    expect(formatFieldErrors([{ field: 'currencyCode', message: 'must be three letters' }])).toBe(
      'must be three letters',
    );
    expect(
      formatFieldErrors([
        { field: 'currencyCode', message: 'must be three letters' },
        { field: 'providerSeriesId', message: 'must not be blank' },
      ]),
    ).toBe('currencyCode: must be three letters, providerSeriesId: must not be blank');
  });
});
