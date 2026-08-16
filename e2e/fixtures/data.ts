import type { User } from '@/types/auth';
import type { CurrencySeriesResponse } from '@/types/currency';
import type { SessionStatus } from '@/types/session';
import type { Transaction } from '@/types/transaction';

export function buildAuthenticatedUser(overrides: Partial<User> = {}): User {
  return {
    sub: 'auth0|e2e-user-001',
    email: 'browser-fixture@example.test',
    name: 'Browser Fixture User',
    authenticated: true,
    roles: ['USER'],
    permissions: ['transactions:read'],
    ...overrides,
  };
}

export function buildSessionStatus(overrides: Partial<SessionStatus> = {}): SessionStatus {
  return {
    userId: 'auth0|e2e-user-001',
    roles: ['USER'],
    expiresAt: 1_800_000_000,
    ...overrides,
  };
}

export function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1001,
    accountId: 'e2e-checking-001',
    bankName: 'Fixture Bank',
    date: '2026-08-15',
    currencyIsoCode: 'USD',
    amount: 42.5,
    type: 'DEBIT',
    description: 'Deterministic browser fixture transaction',
    createdAt: '2026-08-15T12:00:00Z',
    updatedAt: '2026-08-15T12:00:00Z',
    ...overrides,
  };
}

export function buildCurrency(
  overrides: Partial<CurrencySeriesResponse> = {},
): CurrencySeriesResponse {
  return {
    id: 840,
    currencyCode: 'USD',
    providerSeriesId: 'FIXTURE-USD',
    enabled: true,
    createdAt: '2026-08-15T12:00:00Z',
    updatedAt: '2026-08-15T12:00:00Z',
    ...overrides,
  };
}
