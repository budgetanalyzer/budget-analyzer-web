import { describe, expect, it } from 'vitest';
import { ApiError } from '@/types/apiError';
import { formatApiError, getErrorMessage } from '@/utils/errorMessages';

describe('error message utilities', () => {
  it.each([
    ['MISSING_ORIGINAL_FILENAME', 'The uploaded file must include a filename.'],
    ['BATCH_IMPORT_NO_TRANSACTIONS_CREATED', 'All submitted rows were skipped as duplicates.'],
    [
      'PREVIEW_IMPORT_TOKEN_INVALID',
      'This preview has expired or is no longer valid. Please preview the file again.',
    ],
    ['PREVIEW_IMPORT_TOKEN_EXPIRED', 'This preview has expired. Please preview the file again.'],
  ])('maps %s to the import review message', (code, message) => {
    expect(getErrorMessage(code)).toBe(message);
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
});
