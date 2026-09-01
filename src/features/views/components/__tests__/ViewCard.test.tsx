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
  it('renders static metadata and two clearly named collection destinations', () => {
    renderWithProviders(<ViewCard view={view} />, { initialEntries: ['/views'] });

    expect(screen.getByText('Static collection')).toBeInTheDocument();
    expect(screen.getByText('4 transactions')).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Open Static collection view' })).toHaveAttribute(
      'href',
      '/views/view-1',
    );
    expect(screen.getByRole('link', { name: 'Open Static collection view' })).toHaveTextContent(
      'Open view',
    );
    expect(
      screen.getByRole('link', { name: 'Open Static collection in Analytics' }),
    ).toHaveAttribute(
      'href',
      '/analytics?scope=view&viewId=view-1&viewMode=monthly&transactionType=debit',
    );
    expect(
      screen.getByRole('link', { name: 'Open Static collection in Analytics' }),
    ).toHaveTextContent('Open in Analytics');
  });
});
