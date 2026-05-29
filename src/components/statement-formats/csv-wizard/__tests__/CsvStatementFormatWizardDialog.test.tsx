import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CsvStatementFormatWizardDialog } from '@/components/statement-formats/csv-wizard/CsvStatementFormatWizardDialog';
import {
  useAnalyzeCsvWizardSample,
  usePreviewCsvWizardMapping,
  useSaveCsvWizardFormat,
} from '@/components/statement-formats/csv-wizard/hooks/useCsvStatementFormatWizard';
import { useCurrencies } from '@/hooks/useCurrencies';
import { renderWithProviders } from '@/testing/test-utils';
import { ApiError } from '@/types/apiError';
import type {
  CsvWizardAnalysisResponse,
  CsvWizardPreviewResponse,
  StatementFormat,
} from '@/types/statementFormat';

vi.mock('@/hooks/useCurrencies');
vi.mock('@/components/statement-formats/csv-wizard/hooks/useCsvStatementFormatWizard');

const mockUseCurrencies = vi.mocked(useCurrencies);
const mockUseAnalyzeCsvWizardSample = vi.mocked(useAnalyzeCsvWizardSample);
const mockUsePreviewCsvWizardMapping = vi.mocked(usePreviewCsvWizardMapping);
const mockUseSaveCsvWizardFormat = vi.mocked(useSaveCsvWizardFormat);

const analysisResponse: CsvWizardAnalysisResponse = {
  headers: ['Date', 'Memo', 'Amount', 'Type'],
  sampleRows: [{ Date: '05/01/2026', Memo: 'Coffee', Amount: '4.50', Type: 'DEBIT' }],
  inferredMapping: {
    dateColumn: 'Date',
    dateFormat: 'MM/dd/uuuu',
    descriptionColumn: 'Memo',
    amountMode: 'SINGLE_AMOUNT_WITH_TYPE',
    amountColumn: 'Amount',
    typeColumn: 'Type',
  },
  confidence: 0.91,
};

const previewResponse: CsvWizardPreviewResponse = {
  transactions: [
    {
      date: '2026-05-01',
      description: 'Coffee',
      amount: 4.5,
      type: 'DEBIT',
      bankName: 'Example Bank',
      currencyIsoCode: 'USD',
      accountId: 'checking-001',
      duplicate: false,
    },
  ],
};

const savedFormat: StatementFormat = {
  id: 99,
  displayName: 'Custom Checking CSV',
  formatType: 'CSV',
  bankName: 'Example Bank',
  defaultCurrencyIsoCode: 'USD',
  scope: 'USER',
  enabled: true,
};

function mockCurrencies() {
  mockUseCurrencies.mockReturnValue({
    data: [
      {
        id: 1,
        currencyCode: 'EUR',
        providerSeriesId: 'DEXUSEU',
        enabled: true,
        createdAt: '2026-05-01T00:00:00Z',
        updatedAt: '2026-05-01T00:00:00Z',
      },
    ],
  } as unknown as ReturnType<typeof useCurrencies>);
}

function mockWizardMutations({
  previewError,
}: {
  previewError?: ApiError;
} = {}) {
  type AnalyzeMutate = ReturnType<typeof useAnalyzeCsvWizardSample>['mutate'];
  type PreviewMutate = ReturnType<typeof usePreviewCsvWizardMapping>['mutate'];
  type SaveMutate = ReturnType<typeof useSaveCsvWizardFormat>['mutate'];

  const analyzeMutate = vi.fn(
    (file: Parameters<AnalyzeMutate>[0], options?: Parameters<AnalyzeMutate>[1]) => {
      options?.onSuccess?.(analysisResponse, file, undefined, undefined as never);
    },
  ) as AnalyzeMutate;
  const previewMutate = vi.fn(
    (variables: Parameters<PreviewMutate>[0], options?: Parameters<PreviewMutate>[1]) => {
      if (previewError) {
        options?.onError?.(previewError, variables, undefined, undefined as never);
        return;
      }

      options?.onSuccess?.(previewResponse, variables, undefined, undefined as never);
    },
  ) as PreviewMutate;
  const saveMutate = vi.fn(
    (variables: Parameters<SaveMutate>[0], options?: Parameters<SaveMutate>[1]) => {
      options?.onSuccess?.(savedFormat, variables, undefined, undefined as never);
    },
  ) as SaveMutate;

  mockUseAnalyzeCsvWizardSample.mockReturnValue({
    mutate: analyzeMutate,
    isPending: false,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useAnalyzeCsvWizardSample>);
  mockUsePreviewCsvWizardMapping.mockReturnValue({
    mutate: previewMutate,
    isPending: false,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof usePreviewCsvWizardMapping>);
  mockUseSaveCsvWizardFormat.mockReturnValue({
    mutate: saveMutate,
    isPending: false,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useSaveCsvWizardFormat>);
}

function mockHookDefaults() {
  mockCurrencies();
  mockWizardMutations();
}

describe('CsvStatementFormatWizardDialog', () => {
  it('analyzes a sample, previews a read-only parse, and saves the created format', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const file = new File(['Date,Memo,Amount,Type'], 'sample.csv', { type: 'text/csv' });

    mockHookDefaults();

    renderWithProviders(
      <CsvStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={onSaved}
      />,
    );

    await user.upload(screen.getByLabelText('CSV sample file'), file);
    await user.click(screen.getByRole('button', { name: /Analyze CSV/ }));

    expect(await screen.findByText('Sample rows')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Display name'), 'Custom Checking CSV');
    await user.type(screen.getByLabelText('Bank name'), 'Example Bank');
    await user.clear(screen.getByLabelText('Date format'));
    await user.type(screen.getByLabelText('Date format'), 'MM/dd/uuuu');

    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Coffee')).toBeInTheDocument();
    expect(within(table).getByText('$4.50')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Save Format/ }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 99,
          displayName: 'Custom Checking CSV',
          scope: 'USER',
        }),
      );
    });
  });

  it('renders field-level preview errors beside mapping controls', async () => {
    const user = userEvent.setup();
    const file = new File(['Date,Memo,Amount'], 'sample.csv', { type: 'text/csv' });

    mockCurrencies();
    mockWizardMutations({
      previewError: new ApiError(422, {
        type: 'VALIDATION_ERROR',
        message: 'Invalid mapping',
        fieldErrors: [
          {
            field: 'mapping.dateFormat',
            message: 'Unsupported date pattern',
          },
        ],
      }),
    });

    renderWithProviders(
      <CsvStatementFormatWizardDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} />,
    );

    await user.upload(screen.getByLabelText('CSV sample file'), file);
    await user.click(screen.getByRole('button', { name: /Analyze CSV/ }));
    await user.type(await screen.findByLabelText('Display name'), 'Custom CSV');
    await user.type(screen.getByLabelText('Bank name'), 'Example Bank');
    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));

    expect(await screen.findByText('Unsupported date pattern')).toBeInTheDocument();
  });
});
