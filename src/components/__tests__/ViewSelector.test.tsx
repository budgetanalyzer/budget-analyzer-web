import type { UseQueryResult } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewSelector } from '@/components/ViewSelector';
import { useViews } from '@/hooks/useViews';
import { renderWithProviders } from '@/testing/test-utils';
import type { ApiError } from '@/types/apiError';
import type { SavedView } from '@/types/view';

vi.mock('@/hooks/useViews');

const mockUseViews = vi.mocked(useViews);

const views: SavedView[] = [
  {
    id: 'current-view',
    name: 'Current View',
    criteria: {},
    openEnded: false,
    pinnedCount: 0,
    excludedCount: 0,
    transactionCount: 4,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'monthly-view',
    name: 'Monthly Review',
    criteria: {},
    openEnded: true,
    pinnedCount: 1,
    excludedCount: 0,
    transactionCount: 12,
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
];

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function mockViews(data: SavedView[]) {
  mockUseViews.mockReturnValue({
    data,
    isLoading: false,
    error: null,
  } as unknown as UseQueryResult<SavedView[], ApiError>);
}

function renderSelector(initialEntry = '/views/current-view') {
  return renderWithProviders(
    <>
      <ViewSelector />
      <LocationProbe />
    </>,
    { initialEntries: [initialEntry] },
  );
}

describe('ViewSelector', () => {
  beforeEach(() => {
    mockUseViews.mockReset();
  });

  it('opens from its named trigger and navigates through asChild saved-view links', async () => {
    mockViews(views);
    const user = userEvent.setup();
    renderSelector();

    expect(screen.getByRole('link', { name: 'Views' })).toHaveAttribute('href', '/views');
    const trigger = screen.getByRole('button', { name: 'Open saved views menu' });
    await user.click(trigger);

    expect(screen.getByRole('menu')).toHaveAttribute('data-align', 'end');
    expect(screen.getByRole('menuitem', { name: 'Current View (4)' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const destination = screen.getByRole('menuitem', { name: 'Monthly Review (12)' });
    expect(destination).toHaveAttribute('href', '/views/monthly-view');

    await user.click(destination);

    expect(screen.getByTestId('location')).toHaveTextContent('/views/monthly-view');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders the saved-view empty state in the opened menu', async () => {
    mockViews([]);
    const user = userEvent.setup();
    renderSelector('/views');

    await user.click(screen.getByRole('button', { name: 'Open saved views menu' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('No saved views yet')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});
