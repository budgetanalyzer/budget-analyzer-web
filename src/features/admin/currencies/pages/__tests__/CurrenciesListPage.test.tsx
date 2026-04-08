import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';

vi.mock('@/features/auth/hooks/usePermission');
vi.mock('@/hooks/useCurrencies');

import { usePermission } from '@/features/auth/hooks/usePermission';
import { useCurrencies } from '@/hooks/useCurrencies';
import { CurrenciesListPage } from '@/features/admin/currencies/pages/CurrenciesListPage';
import type { CurrencySeriesResponse } from '@/types/currency';
import type { ApiError } from '@/types/apiError';

const mockUsePermission = vi.mocked(usePermission);
const mockUseCurrencies = vi.mocked(useCurrencies);

const currencies: CurrencySeriesResponse[] = [
  {
    id: 1,
    currencyCode: 'USD',
    providerSeriesId: 'DEXUSEU',
    enabled: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    currencyCode: 'EUR',
    providerSeriesId: 'DEXUSEU',
    enabled: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

function mockQuerySuccess(data: CurrencySeriesResponse[]) {
  mockUseCurrencies.mockReturnValue({
    data,
    isLoading: false,
    error: null,
  } as unknown as UseQueryResult<CurrencySeriesResponse[], ApiError>);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/currencies']}>
      <CurrenciesListPage />
    </MemoryRouter>,
  );
}

describe('CurrenciesListPage permission gating', () => {
  beforeEach(() => {
    mockUsePermission.mockReset();
    mockUseCurrencies.mockReset();
  });

  it('hides the Add Currency button and per-row Edit when currencies:write is missing', () => {
    mockUsePermission.mockReturnValue(false);
    mockQuerySuccess(currencies);
    renderPage();

    // Rows render
    expect(screen.getByText('USD')).toBeInTheDocument();
    expect(screen.getByText('EUR')).toBeInTheDocument();
    // Write affordances absent
    expect(screen.queryByRole('button', { name: /Add Currency/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(mockUsePermission).toHaveBeenCalledWith('currencies:write');
  });

  it('shows the Add Currency button and per-row Edit when currencies:write is granted', () => {
    mockUsePermission.mockReturnValue(true);
    mockQuerySuccess(currencies);
    renderPage();

    expect(screen.getByText('USD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Currency/ })).toBeInTheDocument();
    // One Edit button per row
    expect(screen.getAllByRole('button', { name: /Edit/ })).toHaveLength(currencies.length);
  });
});
