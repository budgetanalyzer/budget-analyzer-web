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
import type { StatementFormat } from '@/types/statementFormat';

vi.mock('@/features/transactions/hooks/usePreviewTransactions');
vi.mock('@/components/statement-formats/csv-wizard/CsvStatementFormatWizardDialog', () => ({
  CsvStatementFormatWizardDialog: ({
    open,
    onOpenChange,
    onSaved,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: (format: StatementFormat) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Create statement format">
        <button type="button" onClick={() => onOpenChange(false)}>
          Cancel wizard
        </button>
        <button
          type="button"
          onClick={() =>
            onSaved({
              id: 99,
              displayName: 'Custom Checking CSV',
              formatType: 'CSV',
              bankName: 'Custom Bank',
              defaultCurrencyIsoCode: 'USD',
              scope: 'USER',
              enabled: true,
            })
          }
        >
          Save wizard format
        </button>
      </div>
    ) : null,
}));

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

const defaultFormats: StatementFormat[] = [
  {
    id: 1,
    formatKey: 'acme-csv',
    displayName: 'Acme Checking CSV',
    formatType: 'CSV',
    bankName: 'Acme Bank',
    defaultCurrencyIsoCode: 'USD',
    scope: 'SYSTEM',
    enabled: true,
  },
  {
    id: 2,
    formatKey: 'disabled-csv',
    displayName: 'Disabled CSV',
    formatType: 'CSV',
    bankName: 'Disabled Bank',
    defaultCurrencyIsoCode: 'USD',
    scope: 'SYSTEM',
    enabled: false,
  },
];

function useReferenceDataHandlers(formats: StatementFormat[] = defaultFormats) {
  server.use(
    http.get('/api/v1/statement-formats', () => HttpResponse.json(formats)),
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
  it('previews the selected file with statement format ID and account query params, then opens the preview modal', async () => {
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
        statementFormatId: 1,
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

  it('opens the CSV wizard from the new format button and preserves the import form on cancel', async () => {
    const user = userEvent.setup();
    const previewMutate = mockPreviewMutation();

    useReferenceDataHandlers();

    renderWithProviders(<ImportButton />);

    await user.click(screen.getByRole('button', { name: /Import Transactions/ }));
    await user.click(screen.getByRole('button', { name: 'New format' }));

    expect(screen.getByRole('dialog', { name: 'Create statement format' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel wizard' }));

    expect(
      screen.queryByRole('dialog', { name: 'Create statement format' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Preview Transactions/ })).toBeDisabled();
    expect(previewMutate).not.toHaveBeenCalled();
  });

  it('selects a saved wizard format and submits its statement format ID', async () => {
    const user = userEvent.setup();
    const file = new File(['date,description,amount'], 'statement.csv', { type: 'text/csv' });
    let capturedVariables: PreviewVariables | undefined;

    const previewMutate = vi.fn((variables: PreviewVariables) => {
      capturedVariables = variables;
    }) as PreviewMutate;
    mockPreviewMutation({ mutate: previewMutate });

    useReferenceDataHandlers();

    renderWithProviders(<ImportButton />);

    await user.click(screen.getByRole('button', { name: /Import Transactions/ }));
    await user.type(screen.getByPlaceholderText('Account ID (optional)'), 'checking-789');
    await user.click(screen.getByRole('button', { name: 'New format' }));
    await user.click(screen.getByRole('button', { name: 'Save wizard format' }));

    expect(
      screen.queryByRole('dialog', { name: 'Create statement format' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Custom Checking CSV/ })).toBeInTheDocument();
    expect(screen.getByText(/Custom Checking CSV saved/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Account ID (optional)')).toHaveValue('checking-789');
    expect(previewMutate).not.toHaveBeenCalled();

    await user.upload(screen.getByLabelText('Transaction file input'), file);
    await user.click(screen.getByRole('button', { name: /Preview Transactions/ }));

    await waitFor(() => {
      expect(capturedVariables).toEqual({
        file,
        statementFormatId: 99,
        accountId: 'checking-789',
      });
    });
  });

  it('disambiguates duplicate display names by source without showing parser revisions', async () => {
    const user = userEvent.setup();

    useReferenceDataHandlers([
      {
        id: 10,
        displayName: 'Shared CSV',
        formatType: 'CSV',
        bankName: 'Acme Bank',
        defaultCurrencyIsoCode: 'USD',
        scope: 'SYSTEM',
        enabled: true,
      },
      {
        id: 11,
        displayName: 'Shared CSV',
        formatType: 'CSV',
        bankName: 'Acme Bank',
        defaultCurrencyIsoCode: 'USD',
        scope: 'USER',
        enabled: true,
      },
    ]);

    renderWithProviders(<ImportButton />);

    await user.click(screen.getByRole('button', { name: /Import Transactions/ }));
    await user.click(await screen.findByRole('button', { name: 'Select Format' }));

    expect(screen.getByRole('button', { name: 'Shared CSV System' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shared CSV Custom' })).toBeInTheDocument();
    expect(screen.queryByText(/revision/i)).not.toBeInTheDocument();
  });
});
