import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { UseQueryResult } from '@tanstack/react-query';

vi.mock('@/features/auth/hooks/useAuth');
vi.mock('@/features/auth/hooks/usePermission');
vi.mock('@/hooks/useCurrencies');
vi.mock('@/hooks/useStatementFormats');
vi.mock('@/features/admin/transactions/api/useTransactionSearch');

import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { useCurrencies } from '@/hooks/useCurrencies';
import { useStatementFormats } from '@/hooks/useStatementFormats';
import { useTransactionSearch } from '@/features/admin/transactions/api/useTransactionSearch';
import { AdminDashboard } from '@/features/admin/pages/AdminDashboard';
import type { CurrencySeriesResponse } from '@/types/currency';
import type { StatementFormat } from '@/types/statementFormat';
import type { PagedResponse, TransactionSearchResult } from '@/types/transactionSearch';
import type { ApiError } from '@/types/apiError';

const mockUseAuth = vi.mocked(useAuth);
const mockUsePermission = vi.mocked(usePermission);
const mockUseCurrencies = vi.mocked(useCurrencies);
const mockUseStatementFormats = vi.mocked(useStatementFormats);
const mockUseTransactionSearch = vi.mocked(useTransactionSearch);

function setPermissions(granted: string[]) {
  mockUsePermission.mockImplementation((permission: string) => granted.includes(permission));
}

function stubQueries() {
  mockUseCurrencies.mockReturnValue({
    data: [
      {
        id: 1,
        currencyCode: 'USD',
        providerSeriesId: 'DEXUSEU',
        enabled: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ] as CurrencySeriesResponse[],
    isLoading: false,
    error: null,
  } as unknown as UseQueryResult<CurrencySeriesResponse[], ApiError>);

  mockUseStatementFormats.mockReturnValue({
    data: [
      {
        id: 1,
        formatKey: 'acme-csv',
        displayName: 'Acme CSV',
        formatType: 'CSV',
        bankName: 'Acme Bank',
        defaultCurrencyIsoCode: 'USD',
        enabled: true,
      },
    ] as StatementFormat[],
    isLoading: false,
    error: null,
  } as unknown as UseQueryResult<StatementFormat[], ApiError>);

  mockUseTransactionSearch.mockReturnValue({
    data: {
      content: [],
      metadata: { totalElements: 42, totalPages: 1, size: 1, number: 0 },
    } as unknown as PagedResponse<TransactionSearchResult>,
    isLoading: false,
    error: null,
  } as unknown as UseQueryResult<PagedResponse<TransactionSearchResult>, ApiError>);
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <AdminDashboard />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockUsePermission.mockReset();
  mockUseCurrencies.mockReset();
  mockUseStatementFormats.mockReset();
  mockUseTransactionSearch.mockReset();
  mockUseAuth.mockReturnValue({
    user: {
      sub: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      authenticated: true,
      roles: ['ADMIN'],
      permissions: [],
    },
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  });
  stubQueries();
});

describe('AdminDashboard permission gating', () => {
  it('hides every card when no read permissions are granted and skips the underlying queries', () => {
    setPermissions([]);
    renderDashboard();

    expect(screen.queryByRole('heading', { name: 'Currencies' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Statement Formats' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Transactions' })).not.toBeInTheDocument();

    // Card subtrees never mounted, so the data hooks never fired.
    expect(mockUseCurrencies).not.toHaveBeenCalled();
    expect(mockUseStatementFormats).not.toHaveBeenCalled();
    expect(mockUseTransactionSearch).not.toHaveBeenCalled();
  });

  it('shows only the Currencies card (and calls only its query) when only currencies:read is granted', () => {
    setPermissions(['currencies:read']);
    renderDashboard();

    expect(screen.getByRole('heading', { name: 'Currencies' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Statement Formats' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Transactions' })).not.toBeInTheDocument();

    expect(mockUseCurrencies).toHaveBeenCalled();
    expect(mockUseStatementFormats).not.toHaveBeenCalled();
    expect(mockUseTransactionSearch).not.toHaveBeenCalled();

    // No write → no Add new affordance on the Currencies card.
    expect(screen.queryByRole('link', { name: /Add new/ })).not.toBeInTheDocument();
  });

  it('surfaces the Currencies "Add new" affordance when currencies:write is granted', () => {
    setPermissions(['currencies:read', 'currencies:write']);
    renderDashboard();

    expect(screen.getByRole('heading', { name: 'Currencies' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add new/ })).toBeInTheDocument();
  });

  it('shows only the Statement Formats card when only statementformats:read is granted', () => {
    setPermissions(['statementformats:read']);
    renderDashboard();

    expect(screen.queryByRole('heading', { name: 'Currencies' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Statement Formats' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Transactions' })).not.toBeInTheDocument();

    expect(mockUseCurrencies).not.toHaveBeenCalled();
    expect(mockUseStatementFormats).toHaveBeenCalled();
    expect(mockUseTransactionSearch).not.toHaveBeenCalled();

    // No :write → no "Add new" on the Statement Formats card.
    expect(screen.queryByRole('link', { name: /Add new/ })).not.toBeInTheDocument();
  });

  it('surfaces the Statement Formats "Add new" affordance when statementformats:write is granted', () => {
    setPermissions(['statementformats:read', 'statementformats:write']);
    renderDashboard();

    expect(screen.getByRole('heading', { name: 'Statement Formats' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add new/ })).toBeInTheDocument();
  });

  it('shows only the Transactions card when only transactions:read:any is granted', () => {
    setPermissions(['transactions:read:any']);
    renderDashboard();

    expect(screen.queryByRole('heading', { name: 'Currencies' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Statement Formats' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Transactions' })).toBeInTheDocument();

    expect(mockUseCurrencies).not.toHaveBeenCalled();
    expect(mockUseStatementFormats).not.toHaveBeenCalled();
    expect(mockUseTransactionSearch).toHaveBeenCalled();
  });

  it('shows all cards when every read permission is granted', () => {
    setPermissions(['currencies:read', 'statementformats:read', 'transactions:read:any']);
    renderDashboard();

    expect(screen.getByRole('heading', { name: 'Currencies' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Statement Formats' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
  });
});
