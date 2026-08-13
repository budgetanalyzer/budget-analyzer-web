import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportButton } from '@/features/transactions/components/ImportButton';
import { usePreviewTransactions } from '@/features/transactions/hooks/usePreviewTransactions';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { PreviewResponse } from '@/types/transaction';
import { ApiError } from '@/types/apiError';
import type { StatementFormat } from '@/types/statementFormat';

vi.mock('@/features/transactions/hooks/usePreviewTransactions');
vi.mock('@/features/auth/hooks/usePermission');
vi.mock('@/components/statement-formats/StatementFormatWizardDialog', () => ({
  StatementFormatWizardDialog: ({
    open,
    onOpenChange,
    onCancel,
    initialAccountId,
    onSaved,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCancel?: () => void;
    initialAccountId?: string;
    onSaved: (format: StatementFormat) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Create statement format">
        <div>Initial account ID: {initialAccountId ?? ''}</div>
        <button
          type="button"
          onClick={() => {
            onCancel?.();
            onOpenChange(false);
          }}
        >
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
        <button
          type="button"
          onClick={() =>
            onSaved({
              id: 100,
              displayName: 'Custom Checking PDF',
              formatType: 'PDF',
              bankName: 'Custom Bank',
              defaultCurrencyIsoCode: 'USD',
              scope: 'USER',
              enabled: true,
            })
          }
        >
          Save PDF wizard format
        </button>
      </div>
    ) : null,
}));

const mockUsePreviewTransactions = vi.mocked(usePreviewTransactions);
const mockUsePermission = vi.mocked(usePermission);
type PreviewMutate = ReturnType<typeof usePreviewTransactions>['mutate'];
type PreviewVariables = Parameters<PreviewMutate>[0];
type PreviewMutateOptions = Parameters<PreviewMutate>[1];

const previewResponse: PreviewResponse = {
  files: [
    {
      sourceFile: 'statement.csv',
      statementFormatId: 1,
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
    },
    {
      sourceFile: 'statement-2.pdf',
      statementFormatId: 1,
      previewImportToken: 'preview-token-456',
      fileImport: {
        alreadyImported: false,
      },
      transactions: [
        {
          date: '2026-05-02',
          description: 'Groceries',
          amount: 25,
          type: 'DEBIT',
          bankName: 'Acme Bank',
          currencyIsoCode: 'USD',
          duplicate: false,
        },
      ],
    },
  ],
};

const defaultFormats: StatementFormat[] = [
  {
    id: 1,
    displayName: 'Acme Checking CSV',
    formatType: 'CSV',
    bankName: 'Acme Bank',
    defaultCurrencyIsoCode: 'USD',
    scope: 'SYSTEM',
    enabled: true,
  },
  {
    id: 2,
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
    reset: vi.fn(),
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
  mockUsePermission.mockReset();
  mockUsePermission.mockReturnValue(true);
  mockPreviewMutation();
});

describe('ImportButton', () => {
  it('previews selected files in order with shared params, then opens the grouped preview modal', async () => {
    const user = userEvent.setup();
    const firstFile = new File(['date,description,amount'], 'statement.csv', {
      type: 'text/csv',
    });
    const secondFile = new File(['%PDF-1.7'], 'statement-2.pdf', {
      type: 'application/pdf',
    });
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
    const fileInput = screen.getByLabelText('Transaction file input');
    expect(fileInput).toHaveAttribute('multiple');
    await user.upload(fileInput, [firstFile, secondFile]);
    expect(screen.getByRole('button', { name: '2 files selected' })).toBeInTheDocument();
    expect(screen.queryByText(firstFile.name)).not.toBeInTheDocument();
    expect(screen.queryByText(secondFile.name)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Preview Transactions/ }));

    await waitFor(() => {
      expect(capturedVariables).toEqual({
        files: [firstFile, secondFile],
        statementFormatId: 1,
        accountId: 'checking-123',
      });
    });
    expect(await screen.findByRole('heading', { name: 'Preview Import' })).toBeInTheDocument();
    expect(screen.getByText('2 files | 2 transactions')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Coffee')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Groceries')).toBeInTheDocument();
    expect(fileInput).toHaveProperty('files.length', 0);
    expect(screen.getByRole('button', { name: 'Import Transactions' })).toBeInTheDocument();
  });

  it('shows one filename and replaces the native selection when files are chosen again', async () => {
    const user = userEvent.setup();
    const firstFile = new File(['first'], 'first.csv', { type: 'text/csv' });
    const secondFile = new File(['second'], 'second.csv', { type: 'text/csv' });
    const replacementFile = new File(['replacement'], 'replacement.pdf', {
      type: 'application/pdf',
    });

    useReferenceDataHandlers();
    renderWithProviders(<ImportButton />);

    await expandImportForm(user);
    const fileInput = screen.getByLabelText('Transaction file input');

    await user.upload(fileInput, firstFile);
    expect(screen.getByRole('button', { name: 'first.csv' })).toBeInTheDocument();

    await user.upload(fileInput, [firstFile, secondFile]);
    expect(screen.getByRole('button', { name: '2 files selected' })).toBeInTheDocument();

    await user.upload(fileInput, replacementFile);
    expect(screen.getByRole('button', { name: 'replacement.pdf' })).toBeInTheDocument();
    expect(fileInput).toHaveProperty('files.length', 1);
    expect((fileInput as HTMLInputElement).files?.[0]).toBe(replacementFile);
  });

  it('opens the native file input from the choose-file button', async () => {
    const user = userEvent.setup();

    useReferenceDataHandlers();
    renderWithProviders(<ImportButton />);

    await expandImportForm(user);
    const fileInput = screen.getByLabelText('Transaction file input');
    const clickSpy = vi.spyOn(fileInput, 'click');

    await user.click(screen.getByRole('button', { name: 'Choose File' }));

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('clears the entire native selection when the import form is cancelled', async () => {
    const user = userEvent.setup();
    const firstFile = new File(['first'], 'first.csv', { type: 'text/csv' });
    const secondFile = new File(['second'], 'second.csv', { type: 'text/csv' });

    useReferenceDataHandlers();
    renderWithProviders(<ImportButton />);

    await expandImportForm(user);
    const fileInput = screen.getByLabelText('Transaction file input');
    await user.upload(fileInput, [firstFile, secondFile]);

    await user.click(screen.getByRole('button', { name: 'Cancel import' }));

    expect(fileInput).toHaveProperty('files.length', 0);
    expect(screen.getByRole('button', { name: 'Import Transactions' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '2 files selected' })).not.toBeInTheDocument();
    });
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

  it('passes a filename-bearing first-file failure to the page error callback without opening a partial modal', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const failedFile = new File(['bad csv'], 'bad-statement.csv', { type: 'text/csv' });
    const unprocessedFile = new File(['valid csv'], 'unprocessed-statement.csv', {
      type: 'text/csv',
    });
    let capturedVariables: PreviewVariables | undefined;

    useReferenceDataHandlers();
    const previewError = new ApiError(422, {
      type: 'APPLICATION_ERROR',
      message: "Failed to preview file 'bad-statement.csv': Missing required Description column",
      code: 'CSV_PARSING_ERROR',
    });
    const previewMutate = vi.fn((variables: PreviewVariables, options?: PreviewMutateOptions) => {
      capturedVariables = variables;
      options?.onError?.(previewError, variables, undefined, undefined as never);
    }) as PreviewMutate;
    mockPreviewMutation({ mutate: previewMutate });

    renderWithProviders(<ImportButton onError={onError} />);

    await expandImportForm(user);
    await user.upload(screen.getByLabelText('Transaction file input'), [
      failedFile,
      unprocessedFile,
    ]);
    await user.click(screen.getByRole('button', { name: /Preview Transactions/ }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(previewError);
    });
    expect(capturedVariables?.files).toEqual([failedFile, unprocessedFile]);
    expect(previewError.response.message).toContain('bad-statement.csv');
    expect(screen.queryByRole('heading', { name: 'Preview Import' })).not.toBeInTheDocument();
  });

  it('clears the entire import workflow when the create-format wizard is cancelled', async () => {
    const user = userEvent.setup();
    const file = new File(['date,description,amount'], 'statement.csv', { type: 'text/csv' });
    const previewMutate = mockPreviewMutation();

    useReferenceDataHandlers();

    renderWithProviders(<ImportButton />);

    await expandImportForm(user);
    await user.type(screen.getByPlaceholderText('Account ID (optional)'), 'checking-789');
    const fileInput = screen.getByLabelText('Transaction file input');
    await user.upload(fileInput, file);
    await user.click(screen.getByRole('button', { name: 'New format' }));

    expect(screen.getByRole('dialog', { name: 'Create statement format' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel wizard' }));

    expect(
      screen.queryByRole('dialog', { name: 'Create statement format' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import Transactions' })).toBeInTheDocument();
    expect(fileInput).toHaveProperty('files.length', 0);
    expect(previewMutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Import Transactions' }));

    expect(screen.getByRole('button', { name: /Preview Transactions/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select Format' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Account ID (optional)')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Choose File' })).toBeInTheDocument();
  });

  it('shows the new-format button when the user can write statement formats', async () => {
    const user = userEvent.setup();

    useReferenceDataHandlers();

    renderWithProviders(<ImportButton />);

    await user.click(screen.getByRole('button', { name: /Import Transactions/ }));

    expect(screen.getByRole('button', { name: 'New format' })).toBeInTheDocument();
    expect(mockUsePermission).toHaveBeenCalledWith('statementformats:write');
  });

  it('hides the new-format button when the user cannot write statement formats', async () => {
    const user = userEvent.setup();

    mockUsePermission.mockReturnValue(false);
    useReferenceDataHandlers();

    renderWithProviders(<ImportButton />);

    await user.click(screen.getByRole('button', { name: /Import Transactions/ }));

    expect(screen.queryByRole('button', { name: 'New format' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Preview Transactions/ })).toBeDisabled();
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

    expect(screen.getByText('Initial account ID: checking-789')).toBeInTheDocument();

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
        files: [file],
        statementFormatId: 99,
        accountId: 'checking-789',
      });
    });
  });

  it('selects a saved PDF wizard format and submits its statement format ID', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.7'], 'statement.pdf', { type: 'application/pdf' });
    let capturedVariables: PreviewVariables | undefined;

    const previewMutate = vi.fn((variables: PreviewVariables) => {
      capturedVariables = variables;
    }) as PreviewMutate;
    mockPreviewMutation({ mutate: previewMutate });

    useReferenceDataHandlers();

    renderWithProviders(<ImportButton />);

    await user.click(screen.getByRole('button', { name: /Import Transactions/ }));
    await user.click(screen.getByRole('button', { name: 'New format' }));
    await user.click(screen.getByRole('button', { name: 'Save PDF wizard format' }));

    expect(screen.getByRole('button', { name: /Custom Checking PDF/ })).toBeInTheDocument();
    expect(screen.getByText(/Custom Checking PDF saved/)).toBeInTheDocument();
    expect(previewMutate).not.toHaveBeenCalled();

    await user.upload(screen.getByLabelText('Transaction file input'), file);
    await user.click(screen.getByRole('button', { name: /Preview Transactions/ }));

    await waitFor(() => {
      expect(capturedVariables).toEqual({
        files: [file],
        statementFormatId: 100,
        accountId: undefined,
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

  it('uses the default statement-format list so hidden formats are omitted by the API', async () => {
    const user = userEvent.setup();
    const capturedSearchParams: string[] = [];
    const formats: StatementFormat[] = [
      {
        id: 20,
        displayName: 'Visible CSV',
        formatType: 'CSV',
        bankName: 'Acme Bank',
        defaultCurrencyIsoCode: 'USD',
        scope: 'SYSTEM',
        enabled: true,
      },
      {
        id: 21,
        displayName: 'Hidden CSV',
        formatType: 'CSV',
        bankName: 'Acme Bank',
        defaultCurrencyIsoCode: 'USD',
        scope: 'SYSTEM',
        enabled: true,
        hidden: true,
      },
    ];

    server.use(
      http.get('/api/v1/statement-formats', ({ request }) => {
        const url = new URL(request.url);
        capturedSearchParams.push(url.search);

        return HttpResponse.json(
          url.searchParams.get('includeHidden') === 'true'
            ? formats
            : formats.filter((format) => !format.hidden),
        );
      }),
      http.get('/api/v1/currencies', () => HttpResponse.json([])),
    );

    renderWithProviders(<ImportButton />);

    await user.click(screen.getByRole('button', { name: /Import Transactions/ }));
    await user.click(await screen.findByRole('button', { name: 'Select Format' }));

    expect(screen.getByRole('button', { name: 'Visible CSV' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hidden CSV' })).not.toBeInTheDocument();
    expect(capturedSearchParams).toEqual(['']);
  });
});
