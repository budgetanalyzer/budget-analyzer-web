import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BulkDeleteModal } from '@/features/transactions/components/BulkDeleteModal';
import { toast } from '@/hooks/useToast';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';

function ModalHarness({
  selectedIds = [1, 2],
  onSuccess,
}: {
  selectedIds?: number[];
  onSuccess: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <BulkDeleteModal
      selectedIds={selectedIds}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onSuccess={onSuccess}
    />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BulkDeleteModal', () => {
  it('closes and runs success cleanup without a redundant notification when all deletions succeed', async () => {
    const successToast = vi.spyOn(toast, 'success');
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    let requestBody: unknown;
    server.use(
      http.post('/api/v1/transactions/bulk-delete', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ deletedCount: 2, notFoundIds: [] });
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
    expect(successToast).not.toHaveBeenCalled();
  });

  it('retains the partial-result warning before closing and running success cleanup', async () => {
    const warningToast = vi.spyOn(toast, 'warning');
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    server.use(
      http.post('/api/v1/transactions/bulk-delete', () =>
        HttpResponse.json({ deletedCount: 1, notFoundIds: [2] }),
      ),
    );

    renderWithProviders(<ModalHarness onSuccess={onSuccess} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(warningToast).toHaveBeenCalledWith('Deleted 1 of 2. 1 not found or already deleted.');
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'Delete Transactions' })).not.toBeInTheDocument();
  });

  it('retains the zero-deletion error before closing and running success cleanup', async () => {
    const errorToast = vi.spyOn(toast, 'error');
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    server.use(
      http.post('/api/v1/transactions/bulk-delete', () =>
        HttpResponse.json({ deletedCount: 0, notFoundIds: [1, 2] }),
      ),
    );

    renderWithProviders(<ModalHarness onSuccess={onSuccess} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(errorToast).toHaveBeenCalledWith('Failed to delete transactions');
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'Delete Transactions' })).not.toBeInTheDocument();
  });

  it('keeps the dialog open and surfaces request failure feedback', async () => {
    const errorToast = vi.spyOn(toast, 'error');
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    server.use(
      http.post('/api/v1/transactions/bulk-delete', () =>
        HttpResponse.json(
          { type: 'SERVICE_UNAVAILABLE', message: 'Bulk deletion unavailable' },
          { status: 503 },
        ),
      ),
    );

    renderWithProviders(<ModalHarness onSuccess={onSuccess} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('Bulk deletion unavailable'));
    expect(screen.getByRole('heading', { name: 'Delete Transactions' })).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
