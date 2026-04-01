// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/user', () => {
    return HttpResponse.json({
      sub: 'mock-user-id',
      email: 'admin@example.com',
      name: 'Admin User',
      authenticated: true,
      roles: ['ADMIN'],
    });
  }),
  http.get('/api/v1/transactions', () => {
    return HttpResponse.json([
      {
        id: '1',
        accountId: 'acc1',
        bankName: 'Test Bank',
        date: '2024-01-01',
        amount: 100.5,
        type: 'debit',
        description: 'Test transaction',
      },
    ]);
  }),
  http.delete('/api/v1/transactions/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('/auth/session', () => {
    return HttpResponse.json({
      authenticated: true,
      userId: 'mock-user-id',
      roles: ['ADMIN'],
      expiresAt: Math.floor(Date.now() / 1000) + 1800,
      tokenRefreshed: false,
    });
  }),
];
