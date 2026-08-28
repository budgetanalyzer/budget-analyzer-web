import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CreateViewModal } from '@/components/CreateViewModal';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';

beforeAll(() => {
  if (!window.ResizeObserver) {
    window.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  }
});

function createDeferredPromise() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function getDialogBackdrop() {
  const backdrop = screen.getByRole('dialog').previousElementSibling;
  if (!backdrop) throw new Error('Expected a dialog backdrop');
  return backdrop;
}

function createdView(name: string, transactionCount: number) {
  return {
    id: 'created-view',
    name,
    transactionCount,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

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

describe('CreateViewModal', () => {
  it('submits only the name and exact visible transaction ids', async () => {
    let requestBody: unknown;
    server.use(
      http.post('/api/v1/views', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(createdView('Coffee collection', 2), { status: 201 });
      }),
    );
    renderModal({ transactionIds: [8, 2] });
    const nameInput = screen.getByLabelText('View Name');

    expect(nameInput).toHaveAttribute('maxlength', '255');
    await userEvent.type(nameInput, 'Coffee collection');
    await userEvent.click(screen.getByRole('button', { name: 'Save View' }));

    await waitFor(() =>
      expect(requestBody).toEqual({ name: 'Coffee collection', transactionIds: [8, 2] }),
    );
  });

  it('permits an empty collection', async () => {
    let requestBody: unknown;
    server.use(
      http.post('/api/v1/views', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(createdView('Empty collection', 0), { status: 201 });
      }),
    );
    renderModal({ transactionIds: [] });
    await userEvent.type(screen.getByLabelText('View Name'), 'Empty collection');
    await userEvent.click(screen.getByRole('button', { name: 'Save View' }));

    await waitFor(() =>
      expect(requestBody).toEqual({ name: 'Empty collection', transactionIds: [] }),
    );
  });

  it('disables submission while the visible set is unresolved', async () => {
    renderModal({ isReady: false });
    await userEvent.type(screen.getByLabelText('View Name'), 'Pending');
    expect(screen.getByRole('button', { name: 'Save View' })).toBeDisabled();
  });

  it('clears filters and navigates only after success', async () => {
    server.use(
      http.post('/api/v1/views', () =>
        HttpResponse.json(createdView('Coffee collection', 2), { status: 201 }),
      ),
    );
    const { onClose } = renderModal();
    await userEvent.type(screen.getByLabelText('View Name'), 'Coffee collection');
    await userEvent.click(screen.getByRole('button', { name: 'Save View' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/views/created-view'),
    );
    expect(screen.getByTestId('location')).not.toHaveTextContent('q=coffee');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('preserves the name and clears a dismissible failure alert on successful retry', async () => {
    const user = userEvent.setup();
    const retryResponse = createDeferredPromise();
    const requestBodies: unknown[] = [];
    server.use(
      http.post('/api/v1/views', async ({ request }) => {
        requestBodies.push(await request.json());
        if (requestBodies.length < 3) {
          return HttpResponse.json(
            { type: 'INTERNAL_ERROR', message: 'Could not create collection' },
            { status: 500 },
          );
        }

        await retryResponse.promise;
        return HttpResponse.json(createdView('Coffee collection', 2), { status: 201 });
      }),
    );
    const { onClose } = renderModal();
    const nameInput = screen.getByLabelText('View Name');
    await user.type(nameInput, 'Coffee collection');
    await user.click(screen.getByRole('button', { name: 'Save View' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create collection');
    expect(onClose).not.toHaveBeenCalled();
    expect(nameInput).toHaveValue('Coffee collection');
    expect(screen.getByTestId('location')).toHaveTextContent('q=coffee');

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(nameInput).toHaveValue('Coffee collection');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save View' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Save View' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create collection');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save View' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Save View' }));

    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(nameInput).toHaveValue('Coffee collection');
    expect(screen.getByTestId('location')).toHaveTextContent('q=coffee');

    await user.click(getDialogBackdrop());
    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Save as View' })).toBeInTheDocument();
    expect(nameInput).toHaveValue('Coffee collection');

    retryResponse.resolve();

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(requestBodies).toEqual([
      { name: 'Coffee collection', transactionIds: [8, 2] },
      { name: 'Coffee collection', transactionIds: [8, 2] },
      { name: 'Coffee collection', transactionIds: [8, 2] },
    ]);
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/views/created-view'),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('explains stale membership while retaining the name', async () => {
    server.use(
      http.post('/api/v1/views', () =>
        HttpResponse.json(
          {
            type: 'APPLICATION_ERROR',
            message: 'Stale',
            code: 'SAVED_VIEW_MEMBERSHIP_STALE',
          },
          { status: 422 },
        ),
      ),
    );
    renderModal();
    const nameInput = screen.getByLabelText('View Name');
    await userEvent.type(nameInput, 'Coffee collection');
    await userEvent.click(screen.getByRole('button', { name: 'Save View' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/visible transaction set changed/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/snapshot was refreshed/i);
    expect(nameInput).toHaveValue('Coffee collection');
  });
});
