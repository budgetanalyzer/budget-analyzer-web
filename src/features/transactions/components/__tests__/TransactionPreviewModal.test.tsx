import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/testing/mocks/server';
import { TransactionPreviewModal } from '@/features/transactions/components/TransactionPreviewModal';
import type { BatchImportRequest, PreviewResponse, PreviewTransaction } from '@/types/transaction';
import { formatTimestamp } from '@/utils/dates';

const basePreviewTransaction: PreviewTransaction = {
  date: '2026-05-01',
  description: 'Coffee',
  amount: 4.5,
  type: 'DEBIT',
  category: 'Dining',
  bankName: 'Test Bank',
  currencyIsoCode: 'USD',
  accountId: 'checking-123',
  duplicate: false,
  duplicateReason: null,
};

const basePreviewData: PreviewResponse = {
  sourceFile: 'statement.csv',
  detectedFormat: 'capital-one',
  previewImportToken: 'preview-token-123',
  fileImport: {
    alreadyImported: false,
  },
  transactions: [basePreviewTransaction],
};

function renderModal(previewData: PreviewResponse = basePreviewData) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const onOpenChange = vi.fn();
  const onImportComplete = vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <TransactionPreviewModal
        isOpen
        onOpenChange={onOpenChange}
        previewData={previewData}
        onImportComplete={onImportComplete}
      />
    </QueryClientProvider>,
  );

  return { onOpenChange, onImportComplete };
}

function duplicateTransaction(
  duplicateReason: PreviewTransaction['duplicateReason'],
  description: string,
): PreviewTransaction {
  return {
    ...basePreviewTransaction,
    description,
    duplicate: true,
    duplicateReason,
  };
}

function expectBatchRequest(capturedBody: unknown, expected: BatchImportRequest) {
  expect(capturedBody).toEqual(expected);
}

describe('TransactionPreviewModal', () => {
  it('renders the file-level reupload warning with previous import metadata', () => {
    const importedAt = '2026-05-01T12:34:56Z';

    renderModal({
      ...basePreviewData,
      fileImport: {
        alreadyImported: true,
        warningCode: 'FILE_ALREADY_IMPORTED',
        previousImport: {
          originalFilename: 'previous-statement.csv',
          importedAt,
          format: 'capital-one',
          accountId: 'checking-123',
          transactionCount: 42,
        },
      },
    });

    const warning = screen.getByRole('alert');
    expect(warning).toHaveTextContent('This uploaded file has already been imported.');
    expect(warning).toHaveTextContent('previous-statement.csv');
    expect(warning).toHaveTextContent(formatTimestamp(importedAt));
    expect(warning).toHaveTextContent('capital-one');
    expect(warning).toHaveTextContent('checking-123');
    expect(warning).toHaveTextContent('42');
  });

  it('renders duplicate status labels and import-anyway checkboxes only for duplicates', () => {
    renderModal({
      ...basePreviewData,
      transactions: [
        duplicateTransaction('EXISTING_TRANSACTION', 'Coffee'),
        duplicateTransaction('IN_BATCH', 'Coffee duplicate'),
        {
          ...basePreviewTransaction,
          description: 'Groceries',
        },
      ],
    });

    expect(screen.getByText('Already imported')).toBeInTheDocument();
    expect(screen.getByText('Duplicate in file')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { name: 'Import anyway' })).toHaveLength(2);
  });

  it('skips duplicate rows by default when importing', async () => {
    let capturedBody: unknown;
    const { onImportComplete } = renderModal({
      ...basePreviewData,
      transactions: [
        duplicateTransaction('EXISTING_TRANSACTION', 'Coffee'),
        duplicateTransaction('IN_BATCH', 'Coffee duplicate'),
        {
          ...basePreviewTransaction,
          description: 'Groceries',
        },
      ],
    });

    server.use(
      http.post('/api/v1/transactions/batch', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          created: 1,
          duplicatesSkipped: 2,
          duplicatesImported: 0,
          transactions: [],
        });
      }),
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 Transaction, Skip 2 Duplicates' }),
    );

    await waitFor(() => {
      expectBatchRequest(capturedBody, {
        previewImportToken: 'preview-token-123',
        transactions: [
          {
            date: '2026-05-01',
            description: 'Coffee',
            amount: 4.5,
            type: 'DEBIT',
            category: 'Dining',
            bankName: 'Test Bank',
            currencyIsoCode: 'USD',
            accountId: 'checking-123',
          },
          {
            date: '2026-05-01',
            description: 'Coffee duplicate',
            amount: 4.5,
            type: 'DEBIT',
            category: 'Dining',
            bankName: 'Test Bank',
            currencyIsoCode: 'USD',
            accountId: 'checking-123',
          },
          {
            date: '2026-05-01',
            description: 'Groceries',
            amount: 4.5,
            type: 'DEBIT',
            category: 'Dining',
            bankName: 'Test Bank',
            currencyIsoCode: 'USD',
            accountId: 'checking-123',
          },
        ],
      });
    });
    expect(onImportComplete).toHaveBeenCalledWith(1, 2, 0);
  });

  it('disables import when every visible row would be skipped as a duplicate', () => {
    renderModal({
      ...basePreviewData,
      transactions: [
        duplicateTransaction('EXISTING_TRANSACTION', 'Coffee'),
        duplicateTransaction('IN_BATCH', 'Coffee duplicate'),
        duplicateTransaction('EXISTING_TRANSACTION', 'Groceries'),
        duplicateTransaction('IN_BATCH', 'Groceries duplicate'),
      ],
    });

    expect(
      screen.getByRole('button', { name: 'Import 0 Transactions, Skip 4 Duplicates' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('sends allowDuplicate only when a duplicate row is explicitly selected', async () => {
    let capturedBody: unknown;
    const { onImportComplete } = renderModal({
      ...basePreviewData,
      transactions: [
        duplicateTransaction('EXISTING_TRANSACTION', 'Coffee'),
        duplicateTransaction('IN_BATCH', 'Coffee duplicate'),
        {
          ...basePreviewTransaction,
          description: 'Groceries',
        },
      ],
    });

    server.use(
      http.post('/api/v1/transactions/batch', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          created: 2,
          duplicatesSkipped: 1,
          duplicatesImported: 1,
          transactions: [],
        });
      }),
    );

    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Import anyway' })[0]);
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 2 Transactions, Skip 1 Duplicate' }),
    );

    await waitFor(() => {
      expectBatchRequest(capturedBody, {
        previewImportToken: 'preview-token-123',
        transactions: [
          {
            date: '2026-05-01',
            description: 'Coffee',
            amount: 4.5,
            type: 'DEBIT',
            category: 'Dining',
            bankName: 'Test Bank',
            currencyIsoCode: 'USD',
            accountId: 'checking-123',
            allowDuplicate: true,
          },
          {
            date: '2026-05-01',
            description: 'Coffee duplicate',
            amount: 4.5,
            type: 'DEBIT',
            category: 'Dining',
            bankName: 'Test Bank',
            currencyIsoCode: 'USD',
            accountId: 'checking-123',
          },
          {
            date: '2026-05-01',
            description: 'Groceries',
            amount: 4.5,
            type: 'DEBIT',
            category: 'Dining',
            bankName: 'Test Bank',
            currencyIsoCode: 'USD',
            accountId: 'checking-123',
          },
        ],
      });
    });
    expect(onImportComplete).toHaveBeenCalledWith(2, 1, 1);
  });

  it('clears the visible duplicate warning when a duplicate-key field is edited', () => {
    renderModal({
      ...basePreviewData,
      transactions: [duplicateTransaction('EXISTING_TRANSACTION', 'Coffee')],
    });

    expect(screen.getByText('Already imported')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Coffee'), {
      target: { value: 'Coffee updated' },
    });

    expect(screen.queryByText('Already imported')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Import anyway' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 1 Transaction' })).toBeInTheDocument();
  });
});
