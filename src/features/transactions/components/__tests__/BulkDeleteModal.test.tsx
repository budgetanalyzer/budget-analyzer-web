import { useCallback, useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { BulkDeleteModal } from '@/features/transactions/components/BulkDeleteModal';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';

function createDeferredPromise() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function ModalHarness({
  selectedIds = [1, 2],
  onSuccess,
}: {
  selectedIds?: number[];
  onSuccess: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  return (
    <>
      <BulkDeleteModal
        selectedIds={selectedIds}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onSuccess={onSuccess}
      />
      {!isOpen && (
        <button type="button" onClick={handleOpen}>
          Open bulk delete
        </button>
      )}
    </>
  );
}

describe('BulkDeleteModal', () => {
  it.each([
    {
      resultName: 'full deletion',
      response: { deletedCount: 2, notFoundIds: [] },
    },
    {
      resultName: 'partial deletion',
      response: { deletedCount: 1, notFoundIds: [2] },
    },
    {
      resultName: 'all transactions already absent',
      response: { deletedCount: 0, notFoundIds: [1, 2] },
    },
  ])('silently closes and runs success cleanup after $resultName', async ({ response }) => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    let requestBody: unknown;
    server.use(
      http.post('/api/v1/transactions/bulk-delete', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(response);
      }),
    );

    renderWithProviders(<ModalHarness onSuccess={onSuccess} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Delete Transactions' }),
      ).not.toBeInTheDocument();
    });
    expect(requestBody).toEqual({ ids: [1, 2] });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('preserves the selected IDs and clears a dismissible request failure before retry', async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    const retryResponse = createDeferredPromise();
    let requestCount = 0;
    server.use(
      http.post('/api/v1/transactions/bulk-delete', async () => {
        requestCount += 1;
        if (requestCount < 3) {
          return HttpResponse.json(
            { type: 'SERVICE_UNAVAILABLE', message: 'Bulk deletion unavailable' },
            { status: 503 },
          );
        }

        await retryResponse.promise;
        return HttpResponse.json({ deletedCount: 2, notFoundIds: [] });
      }),
    );

    renderWithProviders(<ModalHarness onSuccess={onSuccess} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Bulk deletion unavailable');
    expect(screen.getByText(/delete 2 transactions/i)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/delete 2 transactions/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bulk deletion unavailable');
    expect(onSuccess).not.toHaveBeenCalled();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/delete 2 transactions/i)).toBeInTheDocument();

    retryResponse.resolve();

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Delete Transactions' }),
      ).not.toBeInTheDocument();
    });
    expect(requestCount).toBe(3);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('discards request failure feedback when the dialog closes', async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    server.use(
      http.post('/api/v1/transactions/bulk-delete', () =>
        HttpResponse.json(
          { type: 'INTERNAL_ERROR', message: 'Delete request failed' },
          { status: 500 },
        ),
      ),
    );

    renderWithProviders(<ModalHarness onSuccess={onSuccess} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Delete request failed');

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Open bulk delete' }));

    expect(screen.getByRole('heading', { name: 'Delete Transactions' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/delete 2 transactions/i)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
