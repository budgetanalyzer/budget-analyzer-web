import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useTransactionFiltersSync } from '@/hooks/useTransactionFiltersSync';
import { renderWithProviders } from '@/testing/test-utils';

function FilterHarness() {
  const location = useLocation();
  const {
    filters,
    hasActiveFilters,
    handleDateFilterChange,
    handleSearchChange,
    handleBankNameFilterChange,
    handleAccountIdFilterChange,
    handleTypeFilterChange,
    handleAmountFilterChange,
    clearAllFilters,
  } = useTransactionFiltersSync();

  return (
    <div>
      <div data-testid="location">{`${location.pathname}${location.search}`}</div>
      <div data-testid="search">{filters.globalFilter}</div>
      <div data-testid="date-from">{filters.dateFilter.from ?? ''}</div>
      <div data-testid="date-to">{filters.dateFilter.to ?? ''}</div>
      <div data-testid="bank">{filters.bankNameFilter ?? ''}</div>
      <div data-testid="account">{filters.accountIdFilter ?? ''}</div>
      <div data-testid="type">{filters.typeFilter ?? ''}</div>
      <div data-testid="min">{filters.amountFilter.min ?? ''}</div>
      <div data-testid="max">{filters.amountFilter.max ?? ''}</div>
      <div data-testid="active">{hasActiveFilters() ? 'active' : 'inactive'}</div>
      <button type="button" onClick={() => handleSearchChange('market')}>
        Set Search
      </button>
      <button type="button" onClick={() => handleDateFilterChange('2026-02-01', '2026-02-28')}>
        Set Dates
      </button>
      <button type="button" onClick={() => handleDateFilterChange(null, null)}>
        Clear Dates
      </button>
      <button type="button" onClick={() => handleBankNameFilterChange('New Bank')}>
        Set Bank
      </button>
      <button type="button" onClick={() => handleAccountIdFilterChange('savings')}>
        Set Account
      </button>
      <button type="button" onClick={() => handleTypeFilterChange('CREDIT')}>
        Set Type
      </button>
      <button type="button" onClick={() => handleAmountFilterChange(10, 250)}>
        Set Amounts
      </button>
      <button type="button" onClick={clearAllFilters}>
        Clear All
      </button>
    </div>
  );
}

function renderHarness(initialEntry: string) {
  return renderWithProviders(
    <Routes>
      <Route path="*" element={<FilterHarness />} />
    </Routes>,
    { initialEntries: [initialEntry] },
  );
}

describe('useTransactionFiltersSync', () => {
  it('parses every canonical transaction filter parameter', () => {
    renderHarness(
      '/views/view-1?q=coffee&dateFrom=2026-01-01&dateTo=2026-01-31&bankName=Alpha%20Bank&accountId=checking&type=CREDIT&minAmount=10.5&maxAmount=250',
    );

    expect(screen.getByTestId('search')).toHaveTextContent('coffee');
    expect(screen.getByTestId('date-from')).toHaveTextContent('2026-01-01');
    expect(screen.getByTestId('date-to')).toHaveTextContent('2026-01-31');
    expect(screen.getByTestId('bank')).toHaveTextContent('Alpha Bank');
    expect(screen.getByTestId('account')).toHaveTextContent('checking');
    expect(screen.getByTestId('type')).toHaveTextContent('CREDIT');
    expect(screen.getByTestId('min')).toHaveTextContent('10.5');
    expect(screen.getByTestId('max')).toHaveTextContent('250');
    expect(screen.getByTestId('active')).toHaveTextContent('active');
  });

  it('accepts legacy bank and account aliases', () => {
    renderHarness('/?bank=Legacy%20Bank&account=legacy-account');

    expect(screen.getByTestId('bank')).toHaveTextContent('Legacy Bank');
    expect(screen.getByTestId('account')).toHaveTextContent('legacy-account');
  });

  it('rejects invalid transaction types and non-finite or malformed amounts', () => {
    renderHarness('/?type=TRANSFER&minAmount=Infinity&maxAmount=12oops');

    expect(screen.getByTestId('type')).toBeEmptyDOMElement();
    expect(screen.getByTestId('min')).toBeEmptyDOMElement();
    expect(screen.getByTestId('max')).toBeEmptyDOMElement();
    expect(screen.getByTestId('active')).toHaveTextContent('inactive');
  });

  it('serializes every filter while preserving unrelated URL parameters', async () => {
    renderHarness('/views/view-1?keep=yes&bank=Old%20Bank&account=old-account');

    await userEvent.click(screen.getByRole('button', { name: 'Set Search' }));
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('market'));

    await userEvent.click(screen.getByRole('button', { name: 'Set Dates' }));
    await waitFor(() => expect(screen.getByTestId('date-to')).toHaveTextContent('2026-02-28'));

    await userEvent.click(screen.getByRole('button', { name: 'Set Bank' }));
    await waitFor(() => expect(screen.getByTestId('bank')).toHaveTextContent('New Bank'));

    await userEvent.click(screen.getByRole('button', { name: 'Set Account' }));
    await waitFor(() => expect(screen.getByTestId('account')).toHaveTextContent('savings'));

    await userEvent.click(screen.getByRole('button', { name: 'Set Type' }));
    await waitFor(() => expect(screen.getByTestId('type')).toHaveTextContent('CREDIT'));

    await userEvent.click(screen.getByRole('button', { name: 'Set Amounts' }));

    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId('location').textContent?.split('?')[1]);
      expect(params.get('keep')).toBe('yes');
      expect(params.get('q')).toBe('market');
      expect(params.get('dateFrom')).toBe('2026-02-01');
      expect(params.get('dateTo')).toBe('2026-02-28');
      expect(params.get('bankName')).toBe('New Bank');
      expect(params.get('bank')).toBeNull();
      expect(params.get('accountId')).toBe('savings');
      expect(params.get('account')).toBeNull();
      expect(params.get('type')).toBe('CREDIT');
      expect(params.get('minAmount')).toBe('10');
      expect(params.get('maxAmount')).toBe('250');
    });
  });

  it('preserves analytics return context when the date range is fully cleared', async () => {
    renderHarness(
      '/views/view-1?dateFrom=2026-01-01&dateTo=2026-01-31&q=coffee&returnTo=%2Fanalytics&breadcrumbLabel=Jan%202026',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear Dates' }));

    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId('location').textContent?.split('?')[1]);
      expect(params.get('dateFrom')).toBeNull();
      expect(params.get('dateTo')).toBeNull();
      expect(params.get('q')).toBe('coffee');
      expect(params.get('returnTo')).toBe('/analytics');
      expect(params.get('breadcrumbLabel')).toBe('Jan 2026');
    });
  });

  it('clears canonical filters, aliases, and analytics context while preserving unrelated params', async () => {
    renderHarness(
      '/views/view-1?keep=yes&q=coffee&dateFrom=2026-01-01&dateTo=2026-01-31&bankName=Alpha&bank=Legacy&accountId=checking&account=old&type=DEBIT&minAmount=10&maxAmount=50&returnTo=%2Fanalytics&breadcrumbLabel=January',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear All' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/views/view-1?keep=yes');
    });
    expect(screen.getByTestId('active')).toHaveTextContent('inactive');
  });
});
