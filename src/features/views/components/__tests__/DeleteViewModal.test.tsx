import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { DeleteViewModal } from '@/features/views/components/DeleteViewModal';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { SavedViewMetadata } from '@/types/view';

const view: SavedViewMetadata = {
  id: 'view-1',
  name: 'Groceries',
  transactionCount: 12,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderDeleteViewModal(onClose = vi.fn()) {
  const result = renderWithProviders(
    <Routes>
      <Route
        path="/views/:id"
        element={
          <>
            <DeleteViewModal open onClose={onClose} view={view} />
            <LocationProbe />
          </>
        }
      />
      <Route path="/" element={<LocationProbe />} />
    </Routes>,
    {
      initialEntries: ['/views/view-1'],
    },
  );

  return { onClose, ...result };
}

describe('DeleteViewModal', () => {
  it('shows the view delete impact before confirmation', () => {
    renderDeleteViewModal();

    expect(screen.getByRole('heading', { name: 'Delete View' })).toBeInTheDocument();
    expect(screen.getByText(/delete .*Groceries/)).toBeInTheDocument();
    expect(screen.getByText(/12 transaction memberships/)).toBeInTheDocument();
    expect(screen.getByText(/transactions will not be deleted/)).toBeInTheDocument();
  });

  it('closes and navigates home after a successful delete', async () => {
    const user = userEvent.setup();
    const requestedIds: string[] = [];
    server.use(
      http.delete('/api/v1/views/:id', ({ params }) => {
        requestedIds.push(String(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { onClose } = renderDeleteViewModal();

    await user.click(screen.getByRole('button', { name: 'Delete View' }));

    await waitFor(() => expect(requestedIds).toEqual(['view-1']));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('stays on the current view after failure and clears a dismissible alert on retry', async () => {
    const user = userEvent.setup();
    const retryResponse = createDeferredPromise();
    const requestedIds: string[] = [];
    server.use(
      http.delete('/api/v1/views/:id', async ({ params }) => {
        requestedIds.push(String(params.id));
        if (requestedIds.length < 3) {
          return HttpResponse.json(
            { type: 'INTERNAL_ERROR', message: 'Delete request failed' },
            { status: 500 },
          );
        }

        await retryResponse.promise;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { onClose } = renderDeleteViewModal();

    await user.click(screen.getByRole('button', { name: 'Delete View' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Delete request failed');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/views/view-1');
    expect(screen.getByRole('heading', { name: 'Delete View' })).toBeInTheDocument();
    expect(screen.getByText(/12 transaction memberships/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/views/view-1');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete View' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Delete View' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Delete request failed');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete View' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Delete View' }));

    expect(await screen.findByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/views/view-1');

    await user.click(getDialogBackdrop());
    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Delete View' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/views/view-1');

    retryResponse.resolve();

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(requestedIds).toEqual(['view-1', 'view-1', 'view-1']);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
