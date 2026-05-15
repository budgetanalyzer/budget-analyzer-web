import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateViewModal } from '@/components/CreateViewModal';
import uiReducer from '@/store/uiSlice';
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
  const store = configureStore({ reducer: { ui: uiReducer } });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CreateViewModal open onClose={vi.fn()} criteria={criteria} />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
}

beforeEach(() => {
  mockMutate.mockReset();
});

describe('CreateViewModal', () => {
  it('submits saved-view criteria with dateFrom, dateTo, and transaction type', () => {
    const criteria: ViewCriteriaApi = {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      type: 'DEBIT',
      searchText: 'coffee',
    };

    renderModal(criteria);

    fireEvent.change(screen.getByLabelText(/View Name/i), {
      target: { value: 'January Debits' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save View/i }));

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
