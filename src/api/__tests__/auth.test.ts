import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { getSessionStatus } from '@/api/auth';
import { server } from '@/testing/mocks/server';

describe('auth API', () => {
  it('uses POST for the session heartbeat', async () => {
    let requestMethod: string | undefined;
    server.use(
      http.post('/auth/v1/session', ({ request }) => {
        requestMethod = request.method;
        return HttpResponse.json({
          userId: 'user-1',
          roles: ['USER'],
          expiresAt: 1_800_000_000,
        });
      }),
    );

    await expect(getSessionStatus()).resolves.toEqual({
      userId: 'user-1',
      roles: ['USER'],
      expiresAt: 1_800_000_000,
    });
    expect(requestMethod).toBe('POST');
  });
});
