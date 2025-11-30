// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
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
];
