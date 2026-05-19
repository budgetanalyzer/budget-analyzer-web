import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportButton } from '@/features/transactions/components/ImportButton';
import { usePreviewTransactions } from '@/features/transactions/hooks/usePreviewTransactions';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { PreviewResponse } from '@/types/transaction';
import { ApiError } from '@/types/apiError';

vi.mock('@/features/transactions/hooks/usePreviewTransactions');

const mockUsePreviewTransactions = vi.mocked(usePreviewTransactions);
type PreviewMutate = ReturnType<typeof usePreviewTransactions>['mutate'];
type PreviewVariables = Parameters<PreviewMutate>[0];
type PreviewMutateOptions = Parameters<PreviewMutate>[1];

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

function mockPreviewMutation({
  isPending = false,
  mutate = vi.fn(),
}: {
  isPending?: boolean;
  mutate?: PreviewMutate;
} = {}) {
  mockUsePreviewTransactions.mockReturnValue({
    mutate,
    isPending,
  } as unknown as ReturnType<typeof usePreviewTransactions>);

  return mutate;
}

async function expandImportForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Import Transactions/ }));
  await user.click(await screen.findByRole('button', { name: 'Select Format' }));
  await user.click(screen.getByRole('button', { name: 'Acme Checking CSV' }));
}

beforeEach(() => {
  mockUsePreviewTransactions.mockReset();
  mockPreviewMutation();
});

describe('ImportButton', () => {
  it('previews the selected file with format and account query params, then opens the preview modal', async () => {
    const user = userEvent.setup();
    const file = new File(['date,description,amount'], 'statement.csv', { type: 'text/csv' });
    let capturedVariables: PreviewVariables | undefined;

    const previewMutate = vi.fn((variables: PreviewVariables, options?: PreviewMutateOptions) => {
      capturedVariables = variables;
      options?.onSuccess?.(previewResponse, variables, undefined, undefined as never);
    }) as PreviewMutate;
    mockPreviewMutation({ mutate: previewMutate });

    useReferenceDataHandlers();

    renderWithProviders(<ImportButton />);

    await expandImportForm(user);
    await user.type(screen.getByPlaceholderText('Account ID (optional)'), 'checking-123');
    await user.upload(screen.getByLabelText('Transaction file input'), file);
    expect(screen.getByRole('button', { name: 'statement.csv' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Preview Transactions/ }));

    await waitFor(() => {
      expect(capturedVariables).toEqual({
        file,
        format: 'acme-csv',
        accountId: 'checking-123',
      });
    });
    expect(await screen.findByRole('heading', { name: 'Preview Import' })).toBeInTheDocument();
    expect(screen.getByText('File: statement.csv | 1 transaction')).toBeInTheDocument();
  });

  it('keeps preview disabled until file and format are selected', async () => {
    const user = userEvent.setup();
    const file = new File(['date,description,amount'], 'statement.csv', { type: 'text/csv' });

    useReferenceDataHandlers();

    renderWithProviders(<ImportButton />);

    await user.click(screen.getByRole('button', { name: /Import Transactions/ }));
    expect(screen.getByRole('button', { name: /Preview Transactions/ })).toBeDisabled();

    await user.click(await screen.findByRole('button', { name: 'Select Format' }));
    await user.click(screen.getByRole('button', { name: 'Acme Checking CSV' }));
    expect(screen.getByRole('button', { name: /Preview Transactions/ })).toBeDisabled();

    await user.upload(screen.getByLabelText('Transaction file input'), file);
    expect(screen.getByRole('button', { name: /Preview Transactions/ })).toBeEnabled();
  });

  it('shows the pending state while preview is running', async () => {
    const user = userEvent.setup();
    const file = new File(['date,description,amount'], 'statement.csv', { type: 'text/csv' });

    mockPreviewMutation({ isPending: true });
    useReferenceDataHandlers();

    renderWithProviders(<ImportButton />);

    await expandImportForm(user);
    await user.upload(screen.getByLabelText('Transaction file input'), file);

    expect(await screen.findByRole('button', { name: /Loading/ })).toBeDisabled();
  });

  it('calls the error callback and does not open the preview modal when preview fails', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const file = new File(['bad csv'], 'bad-statement.csv', { type: 'text/csv' });

    useReferenceDataHandlers();
    const previewError = new ApiError(422, {
      type: 'VALIDATION_ERROR',
      message: 'Unable to preview statement',
    });
    const previewMutate = vi.fn((variables: PreviewVariables, options?: PreviewMutateOptions) => {
      options?.onError?.(previewError, variables, undefined, undefined as never);
    }) as PreviewMutate;
    mockPreviewMutation({ mutate: previewMutate });

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
