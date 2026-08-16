import type { UseQueryResult } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CurrencySelector } from '@/components/CurrencySelector';
import { useCurrencies } from '@/hooks/useCurrencies';
import { renderWithProviders } from '@/testing/test-utils';
import type { ApiError } from '@/types/apiError';
import type { CurrencySeriesResponse } from '@/types/currency';

vi.mock('@/hooks/useCurrencies');

const mockUseCurrencies = vi.mocked(useCurrencies);

const currencies: CurrencySeriesResponse[] = [
  {
    id: 1,
    currencyCode: 'EUR',
    providerSeriesId: 'DEXUSEU',
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    currencyCode: 'GBP',
    providerSeriesId: 'DEXUSUK',
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

function mockCurrencies(data: CurrencySeriesResponse[] | undefined, isLoading = false) {
  mockUseCurrencies.mockReturnValue({
    data,
    isLoading,
    error: null,
  } as unknown as UseQueryResult<CurrencySeriesResponse[], ApiError>);
}

function renderSelector(displayCurrency = 'EUR') {
  return renderWithProviders(<CurrencySelector />, {
    preloadedState: {
      ui: {
        theme: 'light',
        displayCurrency,
        adminSidebarOpen: true,
      },
    },
  });
}

describe('CurrencySelector', () => {
  beforeEach(() => {
    mockUseCurrencies.mockReset();
  });

  it('selects an enabled currency, updates Redux, and closes', async () => {
    mockCurrencies(currencies);
    const user = userEvent.setup();
    const { store } = renderSelector();

    const trigger = screen.getByRole('button', { name: 'EUR' });
    await user.click(trigger);

    const menu = screen.getByRole('menu');
    const selectedItem = screen.getByRole('menuitem', { name: 'EUR' });
    expect(selectedItem).toBeEnabled();
    expect(menu).toHaveAttribute('data-align', 'end');

    await user.click(screen.getByRole('menuitem', { name: 'GBP' }));

    expect(store.getState().ui.displayCurrency).toBe('GBP');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GBP' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders no selector while enabled currencies are loading', () => {
    mockCurrencies(undefined, true);

    const { container } = renderSelector();

    expect(container).toBeEmptyDOMElement();
  });
});
