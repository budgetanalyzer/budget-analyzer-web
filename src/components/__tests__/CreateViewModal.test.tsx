import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderModalInRoutes({
  criteria,
  onClose = vi.fn(),
  initialEntry = '/transactions?dateFrom=2026-01-01&q=coffee&returnTo=%2Fanalytics',
}: {
  criteria: ViewCriteriaApi;
  onClose?: () => void;
  initialEntry?: string;
}) {
  const result = renderWithProviders(
    <Routes>
      <Route
        path="/transactions"
        element={
          <>
            <CreateViewModal open onClose={onClose} criteria={criteria} />
            <LocationProbe />
          </>
        }
      />
      <Route path="/views/:id" element={<LocationProbe />} />
    </Routes>,
    {
      initialEntries: [initialEntry],
      router: 'dom',
    },
  );

  return { onClose, ...result };
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

  it('navigates to the created view after a successful save', async () => {
    mockMutate.mockImplementation((_request, options) => {
      options.onSuccess({
        id: 'view-created',
        name: 'January Debits',
        criteria: {},
        openEnded: false,
        pinnedCount: 0,
        excludedCount: 0,
        transactionCount: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });
    });

    const { onClose } = renderModalInRoutes({
      criteria: {
        dateFrom: '2026-01-01',
        searchText: 'coffee',
      },
    });

    await userEvent.type(screen.getByLabelText(/View Name/i), 'January Debits');
    await userEvent.click(screen.getByRole('button', { name: /Save View/i }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByTestId('location')).toHaveTextContent('/views/view-created');
  });

  it('keeps the modal state in place when save does not succeed', async () => {
    const { onClose } = renderModalInRoutes({
      criteria: {
        dateFrom: '2026-01-01',
        searchText: 'coffee',
      },
    });

    await userEvent.type(screen.getByLabelText(/View Name/i), 'January Debits');
    await userEvent.click(screen.getByRole('button', { name: /Save View/i }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/transactions?dateFrom=2026-01-01&q=coffee&returnTo=%2Fanalytics',
    );
  });
});
