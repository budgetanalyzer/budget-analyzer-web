import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateViewModal } from '@/components/CreateViewModal';
import { renderWithProviders } from '@/testing/test-utils';
import type { ViewCriteriaApi } from '@/types/view';

const mockMutate = vi.fn();

vi.mock('@/hooks/useViews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useViews')>();
  return {
    ...actual,
    useCreateView: () => ({ mutate: mockMutate, isPending: false }),
  };
});

beforeAll(() => {
  if (!window.ResizeObserver) {
    window.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  }
});

function renderModal(criteria: ViewCriteriaApi) {
  return renderWithProviders(<CreateViewModal open onClose={vi.fn()} criteria={criteria} />, {
    initialEntries: ['/views'],
    router: 'dom',
  });
}

beforeEach(() => {
  mockMutate.mockReset();
});

describe('CreateViewModal', () => {
  it('submits saved-view criteria with dateFrom, dateTo, and transaction type', async () => {
    const criteria: ViewCriteriaApi = {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      type: 'DEBIT',
      searchText: 'coffee',
    };

    renderModal(criteria);

    await userEvent.type(screen.getByLabelText(/View Name/i), 'January Debits');
    await userEvent.click(screen.getByRole('button', { name: /Save View/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      {
        name: 'January Debits',
        criteria,
        openEnded: false,
      },
      expect.any(Object),
    );
  });

  it('renders transaction type in the criteria summary', () => {
    renderModal({ type: 'CREDIT' });

    expect(screen.getByText('Type: Credit')).toBeInTheDocument();
  });
});
