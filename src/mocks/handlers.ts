// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/auth/v1/user', () => {
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
  http.get('/api/v1/admin/transactions', () => {
    return HttpResponse.json({
      content: [
        {
          id: 1,
          ownerId: 'usr_test123',
          accountId: 'checking-3223',
          bankName: 'Capital One',
          date: '2025-10-14',
          currencyIsoCode: 'USD',
          amount: 100.5,
          type: 'DEBIT',
          description: 'Grocery shopping',
          createdAt: '2025-10-14T10:30:00Z',
          updatedAt: '2025-10-14T10:30:00Z',
        },
      ],
      metadata: {
        page: 0,
        size: 50,
        numberOfElements: 1,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      },
    });
  }),
  http.get('/auth/v1/session', () => {
    return HttpResponse.json({
      userId: 'mock-user-id',
      roles: ['ADMIN'],
      expiresAt: Math.floor(Date.now() / 1000) + 1800,
    });
  }),
];
