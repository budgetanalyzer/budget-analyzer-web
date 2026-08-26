import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateViewModal } from '@/components/CreateViewModal';
import { renderWithProviders } from '@/testing/test-utils';
import { ApiError } from '@/types/apiError';

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), toastError: vi.fn() }));

vi.mock('@/hooks/useViews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useViews')>();
  return { ...actual, useCreateView: () => ({ mutate: mocks.mutate, isPending: false }) };
});
vi.mock('@/hooks/useToast', () => ({ toast: { error: mocks.toastError } }));

beforeAll(() => {
  if (!window.ResizeObserver) {
    window.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  }
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderModal({
  transactionIds = [8, 2],
  isReady = true,
  onClose = vi.fn(),
}: {
  transactionIds?: number[];
  isReady?: boolean;
  onClose?: () => void;
} = {}) {
  const result = renderWithProviders(
    <Routes>
      <Route
        path="/transactions"
        element={
          <>
            <CreateViewModal
              open
              onClose={onClose}
              transactionIds={transactionIds}
              isTransactionIdsReady={isReady}
            />
            <LocationProbe />
          </>
        }
      />
      <Route path="/views/:id" element={<LocationProbe />} />
    </Routes>,
    {
      initialEntries: ['/transactions?q=coffee&minAmount=10&amountCurrency=USD'],
      router: 'dom',
    },
  );
  return { onClose, ...result };
}

beforeEach(() => {
  mocks.mutate.mockReset();
  mocks.toastError.mockReset();
});

describe('CreateViewModal', () => {
  it('submits only the name and exact visible transaction ids', async () => {
    renderModal({ transactionIds: [8, 2] });
    const nameInput = screen.getByLabelText('View Name');

    expect(nameInput).toHaveAttribute('maxlength', '255');
    await userEvent.type(nameInput, 'Coffee collection');
    await userEvent.click(screen.getByRole('button', { name: 'Save View' }));

    expect(mocks.mutate).toHaveBeenCalledWith(
      { name: 'Coffee collection', transactionIds: [8, 2] },
      expect.any(Object),
    );
  });

  it('permits an empty collection', async () => {
    renderModal({ transactionIds: [] });
    await userEvent.type(screen.getByLabelText('View Name'), 'Empty collection');
    await userEvent.click(screen.getByRole('button', { name: 'Save View' }));

    expect(mocks.mutate).toHaveBeenCalledWith(
      { name: 'Empty collection', transactionIds: [] },
      expect.any(Object),
    );
  });

  it('disables submission while the visible set is unresolved', async () => {
    renderModal({ isReady: false });
    await userEvent.type(screen.getByLabelText('View Name'), 'Pending');
    expect(screen.getByRole('button', { name: 'Save View' })).toBeDisabled();
  });

  it('clears filters and navigates only after success', async () => {
    mocks.mutate.mockImplementation((_request, options) => {
      options.onSuccess({ id: 'created-view' });
    });
    const { onClose } = renderModal();
    await userEvent.type(screen.getByLabelText('View Name'), 'Coffee collection');
    await userEvent.click(screen.getByRole('button', { name: 'Save View' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByTestId('location')).toHaveTextContent('/views/created-view');
    expect(screen.getByTestId('location')).not.toHaveTextContent('q=coffee');
  });

  it('keeps the modal and name in place on failure', async () => {
    mocks.mutate.mockImplementation((_request, options) => {
      options.onError(
        new ApiError(500, { type: 'INTERNAL_ERROR', message: 'Could not create collection' }),
      );
    });
    const { onClose } = renderModal();
    const nameInput = screen.getByLabelText('View Name');
    await userEvent.type(nameInput, 'Coffee collection');
    await userEvent.click(screen.getByRole('button', { name: 'Save View' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(nameInput).toHaveValue('Coffee collection');
    expect(screen.getByTestId('location')).toHaveTextContent('q=coffee');
    expect(mocks.toastError).toHaveBeenCalledWith('Could not create collection');
  });

  it('explains stale membership while retaining the name', async () => {
    mocks.mutate.mockImplementation((_request, options) => {
      options.onError(
        new ApiError(422, {
          type: 'APPLICATION_ERROR',
          message: 'Stale',
          code: 'SAVED_VIEW_MEMBERSHIP_STALE',
        }),
      );
    });
    renderModal();
    const nameInput = screen.getByLabelText('View Name');
    await userEvent.type(nameInput, 'Coffee collection');
    await userEvent.click(screen.getByRole('button', { name: 'Save View' }));

    expect(nameInput).toHaveValue('Coffee collection');
    expect(mocks.toastError).toHaveBeenCalledWith(
      expect.stringMatching(/visible transaction set changed/i),
    );
  });
});
