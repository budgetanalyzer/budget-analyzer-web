import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { ImportButton } from '@/features/transactions/components/ImportButton';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { PreviewResponse } from '@/types/transaction';

const previewResponse: PreviewResponse = {
  sourceFile: 'statement.csv',
  detectedFormat: 'acme-csv',
  previewImportToken: 'preview-token-123',
  fileImport: {
    alreadyImported: false,
  },
  transactions: [
    {
      date: '2026-05-01',
      description: 'Coffee',
      amount: 4.5,
      type: 'DEBIT',
      category: 'Dining',
      bankName: 'Acme Bank',
      currencyIsoCode: 'USD',
      accountId: 'checking-123',
      duplicate: false,
      duplicateReason: null,
    },
  ],
};

function useReferenceDataHandlers() {
  server.use(
    http.get('/api/v1/statement-formats', () =>
      HttpResponse.json([
        {
          id: 1,
          formatKey: 'acme-csv',
          displayName: 'Acme Checking CSV',
          formatType: 'CSV',
          bankName: 'Acme Bank',
          defaultCurrencyIsoCode: 'USD',
          enabled: true,
        },
        {
          id: 2,
          formatKey: 'disabled-csv',
          displayName: 'Disabled CSV',
          formatType: 'CSV',
          bankName: 'Disabled Bank',
          defaultCurrencyIsoCode: 'USD',
          enabled: false,
        },
      ]),
    ),
    http.get('/api/v1/currencies', () => HttpResponse.json([])),
  );
}

async function expandImportForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Import Transactions/ }));
  await user.click(await screen.findByRole('button', { name: 'Select Format' }));
  await user.click(screen.getByRole('button', { name: 'Acme Checking CSV' }));
}

describe('ImportButton', () => {
  it('previews the selected file with format and account query params, then opens the preview modal', async () => {
    const user = userEvent.setup();
    const file = new File(['date,description,amount'], 'statement.csv', { type: 'text/csv' });
    let capturedUrl: URL | undefined;
    let requestHadBody = false;

    useReferenceDataHandlers();
    server.use(
      http.post('/api/v1/transactions/preview', async ({ request }) => {
        capturedUrl = new URL(request.url);
        requestHadBody = request.body !== null;

        return HttpResponse.json(previewResponse);
      }),
    );

    renderWithProviders(<ImportButton />);

    await expandImportForm(user);
    await user.type(screen.getByPlaceholderText('Account ID (optional)'), 'checking-123');
    await user.upload(screen.getByLabelText('Transaction file input'), file);
    expect(screen.getByRole('button', { name: 'statement.csv' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Preview Transactions/ }));

    await waitFor(() => {
      expect(capturedUrl?.searchParams.get('format')).toBe('acme-csv');
      expect(capturedUrl?.searchParams.get('accountId')).toBe('checking-123');
      expect(requestHadBody).toBe(true);
    });
    expect(await screen.findByRole('heading', { name: 'Preview Import' })).toBeInTheDocument();
    expect(screen.getByText('File: statement.csv | 1 transaction')).toBeInTheDocument();
  });

  it('keeps preview disabled until file and format are selected, then shows the pending state', async () => {
    const user = userEvent.setup();
    const file = new File(['date,description,amount'], 'statement.csv', { type: 'text/csv' });

    useReferenceDataHandlers();
    server.use(
      http.post('/api/v1/transactions/preview', async () => {
        await delay(150);
        return HttpResponse.json(previewResponse);
      }),
    );

    renderWithProviders(<ImportButton />);

    await user.click(screen.getByRole('button', { name: /Import Transactions/ }));
    expect(screen.getByRole('button', { name: /Preview Transactions/ })).toBeDisabled();

    await user.click(await screen.findByRole('button', { name: 'Select Format' }));
    await user.click(screen.getByRole('button', { name: 'Acme Checking CSV' }));
    expect(screen.getByRole('button', { name: /Preview Transactions/ })).toBeDisabled();

    await user.upload(screen.getByLabelText('Transaction file input'), file);
    await user.click(screen.getByRole('button', { name: /Preview Transactions/ }));

    expect(await screen.findByRole('button', { name: /Loading/ })).toBeDisabled();
  });

  it('calls the error callback and does not open the preview modal when preview fails', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const file = new File(['bad csv'], 'bad-statement.csv', { type: 'text/csv' });

    useReferenceDataHandlers();
    server.use(
      http.post('/api/v1/transactions/preview', () =>
        HttpResponse.json(
          { type: 'VALIDATION_ERROR', message: 'Unable to preview statement' },
          { status: 422 },
        ),
      ),
    );

    renderWithProviders(<ImportButton onError={onError} />);

    await expandImportForm(user);
    await user.upload(screen.getByLabelText('Transaction file input'), file);
    await user.click(screen.getByRole('button', { name: /Preview Transactions/ }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
    expect(screen.queryByRole('heading', { name: 'Preview Import' })).not.toBeInTheDocument();
  });
});
