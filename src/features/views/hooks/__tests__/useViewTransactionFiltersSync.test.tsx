import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useViewTransactionFiltersSync } from '@/features/views/hooks/useViewTransactionFiltersSync';
import { renderWithProviders } from '@/testing/test-utils';

function FilterHarness() {
  const location = useLocation();
  const {
    dateFilter,
    searchText,
    hasActiveFilters,
    handleDateFilterChange,
    handleSearchChange,
    clearAllFilters,
  } = useViewTransactionFiltersSync();

  return (
    <div>
      <div data-testid="location">{`${location.pathname}${location.search}`}</div>
      <div data-testid="date-from">{dateFilter.from ?? ''}</div>
      <div data-testid="date-to">{dateFilter.to ?? ''}</div>
      <div data-testid="search">{searchText}</div>
      <div data-testid="active">{hasActiveFilters ? 'active' : 'inactive'}</div>
      <button type="button" onClick={() => handleSearchChange('market')}>
        Set Search
      </button>
      <button type="button" onClick={() => handleDateFilterChange('2026-02-01', '2026-02-28')}>
        Set Dates
      </button>
      <button type="button" onClick={() => handleDateFilterChange(null, null)}>
        Clear Dates
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
      <Route path="/views/:id" element={<FilterHarness />} />
    </Routes>,
    {
      initialEntries: [initialEntry],
    },
  );
}

describe('useViewTransactionFiltersSync', () => {
  it('parses date and search filters from the URL', () => {
    renderHarness('/views/view-1?dateFrom=2026-01-01&dateTo=2026-01-31&q=coffee');

    expect(screen.getByTestId('date-from')).toHaveTextContent('2026-01-01');
    expect(screen.getByTestId('date-to')).toHaveTextContent('2026-01-31');
    expect(screen.getByTestId('search')).toHaveTextContent('coffee');
    expect(screen.getByTestId('active')).toHaveTextContent('active');
  });

  it('serializes search text while preserving existing URL context', async () => {
    renderHarness('/views/view-1?dateFrom=2026-01-01&returnTo=%2Fanalytics');

    await userEvent.click(screen.getByRole('button', { name: 'Set Search' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/views/view-1?dateFrom=2026-01-01&returnTo=%2Fanalytics&q=market',
      );
    });
  });

  it('clears analytics return context when the date range is fully cleared', async () => {
    renderHarness(
      '/views/view-1?dateFrom=2026-01-01&dateTo=2026-01-31&q=coffee&returnTo=%2Fanalytics&breadcrumbLabel=Jan%202026',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear Dates' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/views/view-1?q=coffee');
    });
  });

  it('clears every view-table filter and analytics return parameter', async () => {
    renderHarness(
      '/views/view-1?dateFrom=2026-01-01&dateTo=2026-01-31&q=coffee&returnTo=%2Fanalytics&breadcrumbLabel=Jan%202026',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear All' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/views/view-1');
    });
    expect(screen.getByTestId('active')).toHaveTextContent('inactive');
  });
});
