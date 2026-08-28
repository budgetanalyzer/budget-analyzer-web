import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { EditViewModal } from '@/features/views/components/EditViewModal';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { SavedViewMetadata } from '@/types/view';

const view: SavedViewMetadata = {
  id: 'view-1',
  name: 'Original name',
  transactionCount: 4,
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

function renderEditViewModal(onClose = vi.fn()) {
  const result = renderWithProviders(<EditViewModal open onClose={onClose} view={view} />);

  return { onClose, ...result };
}

describe('EditViewModal', () => {
  it('renames with a name-only request and the schema maximum', async () => {
    const user = userEvent.setup();
    let requestBody: unknown;
    server.use(
      http.patch('/api/v1/views/:id', async ({ request, params }) => {
        expect(params.id).toBe('view-1');
        requestBody = await request.json();
        return HttpResponse.json({ ...view, name: 'Renamed collection' });
      }),
    );
    const { onClose } = renderEditViewModal();
    expect(screen.getByRole('dialog', { name: 'Rename view' })).toBeInTheDocument();
    const input = screen.getByLabelText('View Name');

    expect(input).toHaveAttribute('maxlength', '255');
    await user.clear(input);
    await user.type(input, 'Renamed collection');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(requestBody).toEqual({ name: 'Renamed collection' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps the edited name after failure and clears a dismissible alert on successful retry', async () => {
    const user = userEvent.setup();
    const retryResponse = createDeferredPromise();
    const requestBodies: unknown[] = [];
    server.use(
      http.patch('/api/v1/views/:id', async ({ request }) => {
        requestBodies.push(await request.json());
        if (requestBodies.length < 3) {
          return HttpResponse.json(
            { type: 'INTERNAL_ERROR', message: 'Rename request failed' },
            { status: 500 },
          );
        }

        await retryResponse.promise;
        return HttpResponse.json({ ...view, name: 'Retained draft' });
      }),
    );
    const { onClose } = renderEditViewModal();
    const input = screen.getByLabelText('View Name');

    await user.clear(input);
    await user.type(input, 'Retained draft');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Rename request failed');
    expect(input).toHaveValue('Retained draft');
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(input).toHaveValue('Retained draft');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Rename request failed');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(input).toHaveValue('Retained draft');

    await user.click(getDialogBackdrop());
    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Rename view' })).toBeInTheDocument();
    expect(input).toHaveValue('Retained draft');

    retryResponse.resolve();

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(requestBodies).toEqual([
      { name: 'Retained draft' },
      { name: 'Retained draft' },
      { name: 'Retained draft' },
    ]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
