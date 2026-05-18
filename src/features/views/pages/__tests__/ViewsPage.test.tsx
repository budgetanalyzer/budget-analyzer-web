import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useViews } from '@/hooks/useViews';
import { SavedView } from '@/types/view';
import { ViewsPage } from '@/features/views/pages/ViewsPage';
import { renderWithProviders } from '@/testing/test-utils';

vi.mock('@/hooks/useViews', () => ({
  useViews: vi.fn(),
}));

const mockUseViews = vi.mocked(useViews);

const savedViews: SavedView[] = [
  {
    id: 'view-groceries',
    name: 'Groceries',
    criteria: {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      searchText: 'market',
      type: 'DEBIT',
    },
    openEnded: false,
    pinnedCount: 2,
    excludedCount: 1,
    transactionCount: 12,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
];

function renderPage() {
  return renderWithProviders(<ViewsPage />, {
    initialEntries: ['/views'],
  });
}

describe('ViewsPage', () => {
  it('renders saved views as detail links without aggregate stats UI', () => {
    mockUseViews.mockReturnValue({
      data: savedViews,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useViews>);

    renderPage();

    expect(screen.getByRole('heading', { name: 'Saved Views' })).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('12 transactions')).toBeInTheDocument();
    expect(screen.getByText('2 pinned')).toBeInTheDocument();
    expect(screen.getByText('1 excluded')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View details for Groceries' })).toHaveAttribute(
      'href',
      '/views/view-groceries',
    );
    expect(screen.getByRole('link', { name: 'Analyze Groceries' })).toHaveAttribute(
      'href',
      '/analytics?scope=view&viewId=view-groceries&viewMode=monthly&transactionType=debit',
    );
    expect(screen.queryByText('Aggregate Statistics')).not.toBeInTheDocument();
    expect(screen.queryByText(/views selected/i)).not.toBeInTheDocument();
  });
});
