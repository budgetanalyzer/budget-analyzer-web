import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/testing/mocks/server';
import { transactionKeys } from '@/queryKeys';
import { renderWithProviders } from '@/testing/test-utils';
import { TransactionPreviewModal } from '@/features/transactions/components/TransactionPreviewModal';
import type {
  BatchImportRequest,
  PreviewFileResponse,
  PreviewResponse,
  PreviewTransaction,
} from '@/types/transaction';
import type { StatementFormat } from '@/types/statementFormat';
import { formatTimestamp } from '@/utils/dates';

function createDeferredPromise() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

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

const basePreviewFile: PreviewFileResponse = {
  sourceFile: 'statement.csv',
  statementFormatId: 7,
  previewImportToken: 'preview-token-123',
  fileImport: {
    alreadyImported: false,
  },
  transactions: [basePreviewTransaction],
};

const basePreviewData: PreviewResponse = {
  files: [basePreviewFile],
};

function previewWithTransactions(transactions: PreviewTransaction[]): PreviewResponse {
  return {
    files: [
      {
        ...basePreviewFile,
        transactions,
      },
    ],
  };
}

function renderModal(
  previewData: PreviewResponse = basePreviewData,
  statementFormats?: StatementFormat[],
) {
  const onOpenChange = vi.fn();
  const onImportComplete = vi.fn();

  const renderResult = renderWithProviders(
    <TransactionPreviewModal
      isOpen
      onOpenChange={onOpenChange}
      previewData={previewData}
      statementFormats={statementFormats}
      onImportComplete={onImportComplete}
    />,
  );

  return { onOpenChange, onImportComplete, queryClient: renderResult.queryClient };
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
  it('preserves the single-file review summary and combined table behavior', () => {
    renderModal();

    expect(screen.getByText('File: statement.csv | 1 transaction')).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByDisplayValue('Coffee')).toBeInTheDocument();
  });

  it('shows aggregate multi-file counts in one table without row-level source attribution', () => {
    renderModal({
      files: [
        basePreviewFile,
        {
          ...basePreviewFile,
          sourceFile: 'second-statement.csv',
          previewImportToken: 'second-preview-token',
          transactions: [{ ...basePreviewTransaction, description: 'Groceries' }],
        },
      ],
    });

    expect(screen.getByText('2 files | 2 transactions')).toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.queryByText('statement.csv')).not.toBeInTheDocument();
    expect(screen.queryByText('second-statement.csv')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Coffee')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Groceries')).toBeInTheDocument();
  });

  it('renders the file-level reupload warning with previous import metadata', () => {
    const importedAt = '2026-05-01T12:34:56Z';

    renderModal(
      {
        files: [
          {
            ...basePreviewFile,
            fileImport: {
              alreadyImported: true,
              warningCode: 'FILE_ALREADY_IMPORTED',
              previousImport: {
                originalFilename: 'previous-statement.csv',
                importedAt,
                statementFormatId: 7,
                accountId: 'checking-123',
                transactionCount: 42,
              },
            },
          },
        ],
      },
      [
        {
          id: 7,
          displayName: 'Capital One CSV',
          formatType: 'CSV',
          bankName: 'Capital One',
          defaultCurrencyIsoCode: 'USD',
          enabled: true,
        },
      ],
    );

    const warning = screen.getByRole('alert');
    expect(warning).toHaveTextContent('This uploaded file has already been imported.');
    expect(warning).toHaveTextContent('Current file: statement.csv');
    expect(warning).toHaveTextContent('previous-statement.csv');
    expect(warning).toHaveTextContent(formatTimestamp(importedAt));
    expect(warning).toHaveTextContent('Capital One CSV');
    expect(warning).toHaveTextContent('checking-123');
    expect(warning).toHaveTextContent('42');
  });

  it('renders an attributable reupload warning for every affected source file', () => {
    const previousImport = {
      originalFilename: 'previous-statement.csv',
      importedAt: '2026-05-01T12:34:56Z',
      statementFormatId: 7,
      accountId: 'checking-123',
      transactionCount: 42,
    };

    renderModal({
      files: [
        {
          ...basePreviewFile,
          sourceFile: 'first-upload.csv',
          fileImport: {
            alreadyImported: true,
            warningCode: 'FILE_ALREADY_IMPORTED',
            previousImport,
          },
        },
        {
          ...basePreviewFile,
          sourceFile: 'second-upload.csv',
          previewImportToken: 'second-preview-token',
          fileImport: {
            alreadyImported: true,
            warningCode: 'FILE_ALREADY_IMPORTED',
            previousImport: {
              ...previousImport,
              originalFilename: 'older-second-upload.csv',
              transactionCount: 18,
            },
          },
          transactions: [{ ...basePreviewTransaction, description: 'Groceries' }],
        },
      ],
    });

    const warnings = screen.getAllByRole('alert');
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toHaveTextContent('Current file: first-upload.csv');
    expect(warnings[0]).toHaveTextContent('previous-statement.csv');
    expect(warnings[1]).toHaveTextContent('Current file: second-upload.csv');
    expect(warnings[1]).toHaveTextContent('older-second-upload.csv');
    expect(warnings[1]).toHaveTextContent('18');
    expect(screen.getByDisplayValue('Coffee')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Groceries')).toBeInTheDocument();
  });

  it('renders duplicate status labels and import-anyway checkboxes only for duplicates', () => {
    renderModal(
      previewWithTransactions([
        duplicateTransaction('EXISTING_TRANSACTION', 'Coffee'),
        duplicateTransaction('IN_BATCH', 'Coffee duplicate'),
        {
          ...basePreviewTransaction,
          description: 'Groceries',
        },
      ]),
    );

    expect(screen.getByText('Already imported')).toBeInTheDocument();
    expect(screen.getByText('Matches earlier file')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { name: 'Import anyway' })).toHaveLength(2);
  });

  it('keeps a later IN_BATCH warning when an earlier source row is edited or removed', async () => {
    renderModal({
      files: [
        basePreviewFile,
        {
          ...basePreviewFile,
          sourceFile: 'second-statement.csv',
          previewImportToken: 'second-preview-token',
          transactions: [duplicateTransaction('IN_BATCH', 'Coffee duplicate')],
        },
      ],
    });

    const earlierDescription = screen.getByDisplayValue('Coffee');
    await userEvent.clear(earlierDescription);
    await userEvent.type(earlierDescription, 'Coffee updated');

    expect(screen.getByText('Matches earlier file')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Import anyway' })).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Remove transaction' })[0]);

    expect(screen.getByText('Matches earlier file')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Import anyway' })).toBeInTheDocument();
  });

  it('skips duplicate rows by default when importing', async () => {
    let capturedBody: unknown;
    const { onImportComplete, onOpenChange } = renderModal(
      previewWithTransactions([
        duplicateTransaction('EXISTING_TRANSACTION', 'Coffee'),
        duplicateTransaction('IN_BATCH', 'Coffee duplicate'),
        {
          ...basePreviewTransaction,
          description: 'Groceries',
        },
      ]),
    );

    server.use(
      http.post('/api/v1/transactions/batch', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          created: 1,
          duplicatesSkipped: 2,
          duplicatesImported: 0,
          files: [],
        });
      }),
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Import 1 Transaction, Skip 2 Duplicates' }),
    );

    await waitFor(() => {
      expectBatchRequest(capturedBody, {
        files: [
          {
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
          },
        ],
      });
    });
    expect(onImportComplete).toHaveBeenCalledWith(1, 2, 0);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('submits every previewed source group in order, including an empty group', async () => {
    let capturedBody: unknown;
    renderModal({
      files: [
        basePreviewFile,
        {
          ...basePreviewFile,
          sourceFile: 'empty-statement.csv',
          previewImportToken: 'empty-preview-token',
          transactions: [],
        },
      ],
    });

    server.use(
      http.post('/api/v1/transactions/batch', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          created: 1,
          duplicatesSkipped: 0,
          duplicatesImported: 0,
          files: [],
        });
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Import 1 Transaction' }));

    await waitFor(() => {
      expectBatchRequest(capturedBody, {
        files: [
          {
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
            ],
          },
          {
            previewImportToken: 'empty-preview-token',
            transactions: [],
          },
        ],
      });
    });
  });

  it('imports a mixed batch after an earlier source group becomes empty', async () => {
    let capturedBody: unknown;
    renderModal({
      files: [
        basePreviewFile,
        {
          ...basePreviewFile,
          sourceFile: 'second-statement.csv',
          previewImportToken: 'second-preview-token',
          transactions: [{ ...basePreviewTransaction, description: 'Groceries' }],
        },
      ],
    });

    server.use(
      http.post('/api/v1/transactions/batch', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          created: 1,
          duplicatesSkipped: 0,
          duplicatesImported: 0,
          files: [],
        });
      }),
    );

    const secondDescription = screen.getByDisplayValue('Groceries');
    await userEvent.clear(secondDescription);
    await userEvent.type(secondDescription, 'Groceries updated');
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove transaction' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Import 1 Transaction' }));

    await waitFor(() => {
      expectBatchRequest(capturedBody, {
        files: [
          {
            previewImportToken: 'preview-token-123',
            transactions: [],
          },
          {
            previewImportToken: 'second-preview-token',
            transactions: [
              {
                date: '2026-05-01',
                description: 'Groceries updated',
                amount: 4.5,
                type: 'DEBIT',
                category: 'Dining',
                bankName: 'Test Bank',
                currencyIsoCode: 'USD',
                accountId: 'checking-123',
              },
            ],
          },
        ],
      });
    });
  });

  it('disables import when every visible row would be skipped as a duplicate', () => {
    renderModal(
      previewWithTransactions([
        duplicateTransaction('EXISTING_TRANSACTION', 'Coffee'),
        duplicateTransaction('IN_BATCH', 'Coffee duplicate'),
        duplicateTransaction('EXISTING_TRANSACTION', 'Groceries'),
        duplicateTransaction('IN_BATCH', 'Groceries duplicate'),
      ]),
    );

    expect(
      screen.getByRole('button', { name: 'Import 0 Transactions, Skip 4 Duplicates' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('disables import for an aggregate-empty review while retaining every empty source', () => {
    renderModal({
      files: [
        {
          ...basePreviewFile,
          transactions: [],
        },
        {
          ...basePreviewFile,
          sourceFile: 'second-empty.csv',
          previewImportToken: 'second-empty-token',
          transactions: [],
        },
      ],
    });

    expect(screen.getByText('2 files | 0 transactions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 0 Transactions' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('sends allowDuplicate only when a duplicate row is explicitly selected', async () => {
    let capturedBody: unknown;
    const { onImportComplete } = renderModal(
      previewWithTransactions([
        duplicateTransaction('EXISTING_TRANSACTION', 'Coffee'),
        duplicateTransaction('IN_BATCH', 'Coffee duplicate'),
        {
          ...basePreviewTransaction,
          description: 'Groceries',
        },
      ]),
    );

    server.use(
      http.post('/api/v1/transactions/batch', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          created: 2,
          duplicatesSkipped: 1,
          duplicatesImported: 1,
          files: [],
        });
      }),
    );

    await userEvent.click(screen.getAllByRole('checkbox', { name: 'Import anyway' })[0]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Import 2 Transactions, Skip 1 Duplicate' }),
    );

    await waitFor(() => {
      expectBatchRequest(capturedBody, {
        files: [
          {
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
          },
        ],
      });
    });
    expect(onImportComplete).toHaveBeenCalledWith(2, 1, 1);
  });

  it('applies an import-anyway choice to the correct nested source row', async () => {
    let capturedBody: unknown;
    renderModal({
      files: [
        {
          ...basePreviewFile,
          transactions: [duplicateTransaction('EXISTING_TRANSACTION', 'Coffee')],
        },
        {
          ...basePreviewFile,
          sourceFile: 'second-statement.csv',
          previewImportToken: 'second-preview-token',
          transactions: [duplicateTransaction('IN_BATCH', 'Coffee duplicate')],
        },
      ],
    });

    server.use(
      http.post('/api/v1/transactions/batch', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          created: 1,
          duplicatesSkipped: 1,
          duplicatesImported: 1,
          files: [],
        });
      }),
    );

    await userEvent.click(screen.getAllByRole('checkbox', { name: 'Import anyway' })[1]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Import 1 Transaction, Skip 1 Duplicate' }),
    );

    await waitFor(() => {
      expect(capturedBody).toEqual({
        files: [
          {
            previewImportToken: 'preview-token-123',
            transactions: [expect.not.objectContaining({ allowDuplicate: true })],
          },
          {
            previewImportToken: 'second-preview-token',
            transactions: [expect.objectContaining({ allowDuplicate: true })],
          },
        ],
      });
    });
  });

  it('keeps same-named sources distinct and passes aggregate response counts unchanged', async () => {
    let capturedBody: unknown;
    const { onImportComplete } = renderModal({
      files: [
        basePreviewFile,
        {
          ...basePreviewFile,
          previewImportToken: 'same-name-second-token',
          transactions: [{ ...basePreviewTransaction, description: 'Groceries' }],
        },
      ],
    });

    server.use(
      http.post('/api/v1/transactions/batch', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          created: 7,
          duplicatesSkipped: 3,
          duplicatesImported: 2,
          files: [
            {
              sourceFile: 'statement.csv',
              created: 1,
              duplicatesSkipped: 0,
              duplicatesImported: 0,
              transactions: [],
            },
            {
              sourceFile: 'statement.csv',
              created: 6,
              duplicatesSkipped: 3,
              duplicatesImported: 2,
              transactions: [],
            },
          ],
        });
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Import 2 Transactions' }));

    await waitFor(() => {
      expect(capturedBody).toEqual({
        files: [
          {
            previewImportToken: 'preview-token-123',
            transactions: [expect.objectContaining({ description: 'Coffee' })],
          },
          {
            previewImportToken: 'same-name-second-token',
            transactions: [expect.objectContaining({ description: 'Groceries' })],
          },
        ],
      });
    });
    expect(onImportComplete).toHaveBeenCalledWith(7, 3, 2);
  });

  it('clears the warned row duplicate state before submitting an edited duplicate key', async () => {
    let capturedBody: unknown;
    renderModal(previewWithTransactions([duplicateTransaction('EXISTING_TRANSACTION', 'Coffee')]));

    server.use(
      http.post('/api/v1/transactions/batch', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          created: 1,
          duplicatesSkipped: 0,
          duplicatesImported: 0,
          files: [],
        });
      }),
    );

    expect(screen.getByText('Already imported')).toBeInTheDocument();

    const descriptionInput = screen.getByDisplayValue('Coffee');
    await userEvent.clear(descriptionInput);
    await userEvent.type(descriptionInput, 'Coffee updated');

    expect(screen.queryByText('Already imported')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Import anyway' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Import 1 Transaction' }));

    await waitFor(() => {
      expect(capturedBody).toEqual({
        files: [
          {
            previewImportToken: 'preview-token-123',
            transactions: [
              expect.objectContaining({
                description: 'Coffee updated',
              }),
            ],
          },
        ],
      });
    });
    expect(JSON.stringify(capturedBody)).not.toContain('allowDuplicate');
  });

  it('sends edited preview field values in the batch import payload', async () => {
    let capturedBody: unknown;
    renderModal();

    server.use(
      http.post('/api/v1/transactions/batch', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          created: 1,
          duplicatesSkipped: 0,
          duplicatesImported: 0,
          files: [],
        });
      }),
    );

    const descriptionInput = screen.getByDisplayValue('Coffee');
    await userEvent.clear(descriptionInput);
    await userEvent.type(descriptionInput, 'Coffee updated');

    const accountInput = screen.getByDisplayValue('checking-123');
    await userEvent.clear(accountInput);
    await userEvent.type(accountInput, 'savings-987');

    const amountInput = screen.getByDisplayValue('4.5');
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '12.34');

    await userEvent.click(screen.getByRole('button', { name: 'Import 1 Transaction' }));

    await waitFor(() => {
      expectBatchRequest(capturedBody, {
        files: [
          {
            previewImportToken: 'preview-token-123',
            transactions: [
              {
                date: '2026-05-01',
                description: 'Coffee updated',
                amount: 12.34,
                type: 'DEBIT',
                category: 'Dining',
                bankName: 'Test Bank',
                currencyIsoCode: 'USD',
                accountId: 'savings-987',
              },
            ],
          },
        ],
      });
    });
  });

  it('invalidates transaction caches after a successful batch import', async () => {
    const { queryClient } = renderModal();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.post('/api/v1/transactions/batch', () =>
        HttpResponse.json({
          created: 1,
          duplicatesSkipped: 0,
          duplicatesImported: 0,
          files: [],
        }),
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Import 1 Transaction' }));

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: transactionKeys.list() });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['transactionCount'] });
      expect(invalidateQueries).toHaveBeenCalledTimes(2);
    });
  });

  it('retains edited rows through dismissible failures and clears the alert on successful retry', async () => {
    const user = userEvent.setup();
    const retryResponse = createDeferredPromise();
    const requestBodies: unknown[] = [];
    const { onOpenChange, onImportComplete } = renderModal();

    server.use(
      http.post('/api/v1/transactions/batch', async ({ request }) => {
        requestBodies.push(await request.json());
        if (requestBodies.length < 3) {
          return HttpResponse.json(
            {
              type: 'APPLICATION_ERROR',
              message: 'Preview import token sources do not match.',
              code: 'BATCH_IMPORT_SOURCE_MISMATCH',
            },
            { status: 422 },
          );
        }

        await retryResponse.promise;
        return HttpResponse.json({
          created: 7,
          duplicatesSkipped: 3,
          duplicatesImported: 2,
          files: [],
        });
      }),
    );

    const descriptionInput = screen.getByDisplayValue('Coffee');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Coffee reviewed');
    await user.click(screen.getByRole('button', { name: 'Import 1 Transaction' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'These files cannot be imported together. Please preview the files together again.',
    );
    expect(screen.getByRole('heading', { name: 'Preview Import' })).toBeInTheDocument();
    expect(descriptionInput).toHaveValue('Coffee reviewed');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onImportComplete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(descriptionInput).toHaveValue('Coffee reviewed');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Import 1 Transaction' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Import 1 Transaction' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'These files cannot be imported together. Please preview the files together again.',
    );
    expect(descriptionInput).toHaveValue('Coffee reviewed');

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Import 1 Transaction' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Import 1 Transaction' }));

    expect(await screen.findByRole('button', { name: 'Importing...' })).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(descriptionInput).toHaveValue('Coffee reviewed');

    retryResponse.resolve();

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onImportComplete).toHaveBeenCalledWith(7, 3, 2);
    expect(requestBodies).toHaveLength(3);
    requestBodies.forEach((requestBody) => {
      expect(requestBody).toEqual({
        files: [
          {
            previewImportToken: 'preview-token-123',
            transactions: [expect.objectContaining({ description: 'Coffee reviewed' })],
          },
        ],
      });
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('clears failed import feedback when the review dialog closes', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onImportComplete } = renderModal();

    server.use(
      http.post('/api/v1/transactions/batch', () =>
        HttpResponse.json(
          { type: 'INTERNAL_ERROR', message: 'Import service unavailable' },
          { status: 500 },
        ),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Import 1 Transaction' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Import service unavailable');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onImportComplete).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('closes on cancel without importing', async () => {
    const { onOpenChange, onImportComplete } = renderModal();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onImportComplete).not.toHaveBeenCalled();
  });

  it('disables close actions while an import is pending', async () => {
    const { onImportComplete } = renderModal();

    server.use(
      http.post('/api/v1/transactions/batch', async () => {
        await delay(100);
        return HttpResponse.json({
          created: 1,
          duplicatesSkipped: 0,
          duplicatesImported: 0,
          files: [],
        });
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Import 1 Transaction' }));

    expect(screen.getByRole('button', { name: 'Importing...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    await waitFor(() => {
      expect(onImportComplete).toHaveBeenCalledWith(1, 0, 0);
    });
  });
});
