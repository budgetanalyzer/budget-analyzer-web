import { ApiError } from '@/types/apiError';

export function assertArrayResponse<T>(data: unknown): T[] {
  if (!Array.isArray(data)) {
    throw new ApiError(502, {
      type: 'INTERNAL_ERROR',
      code: 'INVALID_COLLECTION_RESPONSE',
      message: 'The server returned an invalid collection response. Please try again.',
    });
  }

  return data as T[];
}
