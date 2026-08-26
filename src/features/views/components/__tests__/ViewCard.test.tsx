import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ViewCard } from '@/features/views/components/ViewCard';
import { renderWithProviders } from '@/testing/test-utils';
import type { SavedViewMetadata } from '@/types/view';

const view: SavedViewMetadata = {
  id: 'view-1',
  name: 'Static collection',
  transactionCount: 4,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

describe('ViewCard', () => {
  it('renders only static metadata and collection navigation', () => {
    renderWithProviders(<ViewCard view={view} />, { initialEntries: ['/views'] });

    expect(screen.getByText('Static collection')).toBeInTheDocument();
    expect(screen.getByText('4 transactions')).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View details for Static collection' }),
    ).toHaveAttribute('href', '/views/view-1');
  });
});
