import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiClient } from '@/api/client';
import { server } from '@/testing/mocks/server';
import { ApiError } from '@/types/apiError';

describe('apiClient error normalization', () => {
  it('maps structured API errors to ApiError instances', async () => {
    server.use(
      http.get('/api/v1/client-error/structured', () => {
        return HttpResponse.json(
          {
            type: 'VALIDATION_ERROR',
            message: 'Invalid request payload',
            code: 'INVALID_FIELD',
            fieldErrors: [{ field: 'name', message: 'Name is required' }],
          },
          { status: 422 },
        );
      }),
    );

    await expect(apiClient.get('/v1/client-error/structured')).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      message: 'Invalid request payload',
      response: {
        type: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        code: 'INVALID_FIELD',
      },
    });
  });

  it('maps network failures without responses to service-unavailable ApiErrors', async () => {
    server.use(
      http.get('/api/v1/client-error/network', () => {
        return HttpResponse.error();
      }),
    );

    await expect(apiClient.get('/v1/client-error/network')).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
      response: {
        type: 'SERVICE_UNAVAILABLE',
        message: 'Unable to reach the server. Please try again later.',
      },
    });
  });

  it('preserves the ApiError prototype for normalized errors', async () => {
    server.use(
      http.get('/api/v1/client-error/not-found', () => {
        return HttpResponse.json({ type: 'NOT_FOUND', message: 'Missing thing' }, { status: 404 });
      }),
    );

    await expect(apiClient.get('/v1/client-error/not-found')).rejects.toBeInstanceOf(ApiError);
  });
});
