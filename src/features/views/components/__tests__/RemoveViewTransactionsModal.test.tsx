import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { RemoveViewTransactionsModal } from '@/features/views/components/RemoveViewTransactionsModal';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';

function renderModal(transactionIds = [3, 3, 8]) {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  const result = renderWithProviders(
    <RemoveViewTransactionsModal
      viewId="view-1"
      transactionIds={transactionIds}
      open
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
    />,
  );

  return { ...result, onOpenChange, onSuccess };
}

describe('RemoveViewTransactionsModal', () => {
  it('confirms the unique count and treats a bodyless 204 as complete success', async () => {
    let requestBody: unknown;
    server.use(
      http.patch('/api/v1/views/:id/transactions', async ({ request }) => {
        requestBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { onOpenChange, onSuccess } = renderModal();

    expect(screen.getByText(/Remove 2 transactions from this view/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove from view' }));

    await waitFor(() =>
      expect(requestBody).toEqual({
        addTransactionIds: [],
        removeTransactionIds: [3, 8],
      }),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('cancels without issuing a membership delta', async () => {
    let requestCount = 0;
    server.use(
      http.patch('/api/v1/views/:id/transactions', () => {
        requestCount += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { onOpenChange, onSuccess } = renderModal();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(requestCount).toBe(0);
  });

  it('keeps the dialog and caller selection intact after failure', async () => {
    server.use(
      http.patch('/api/v1/views/:id/transactions', () =>
        HttpResponse.json(
          { type: 'INTERNAL_ERROR', message: 'Membership update failed' },
          { status: 500 },
        ),
      ),
    );
    const { onOpenChange, onSuccess } = renderModal([5]);

    await userEvent.click(screen.getByRole('button', { name: 'Remove from view' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove from view' })).toBeEnabled(),
    );

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Remove from view' })).toBeInTheDocument();
    expect(screen.getByText(/Remove 1 transaction from this view/)).toBeInTheDocument();
  });
});
