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
type AnalyzeMutate = ReturnType<typeof useAnalyzeCsvWizardSample>['mutate'];
type PreviewMutate = ReturnType<typeof usePreviewCsvWizardMapping>['mutate'];
type SaveMutate = ReturnType<typeof useSaveCsvWizardFormat>['mutate'];

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
  analyzeError,
  previewError,
  saveError,
}: {
  analyzeError?: ApiError;
  previewError?: ApiError;
  saveError?: ApiError;
} = {}) {
  const analyzeMutate = vi.fn(
    (file: Parameters<AnalyzeMutate>[0], options?: Parameters<AnalyzeMutate>[1]) => {
      if (analyzeError) {
        options?.onError?.(analyzeError, file, undefined, undefined as never);
        return;
      }

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
      if (saveError) {
        options?.onError?.(saveError, variables, undefined, undefined as never);
        return;
      }

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

  return { analyzeMutate, previewMutate, saveMutate };
}

function mockHookDefaults() {
  mockCurrencies();
  return mockWizardMutations();
}

async function analyzeSample(user: ReturnType<typeof userEvent.setup>, file: File) {
  await user.upload(screen.getByLabelText('CSV sample file'), file);
  await user.click(screen.getByRole('button', { name: /Analyze CSV/ }));
  await screen.findByText('Sample rows');
}

async function fillRequiredMapping(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Display name'), 'Custom Checking CSV');
  await user.type(screen.getByLabelText('Bank name'), 'Example Bank');
}

async function previewMapping(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));
  await screen.findByRole('button', { name: /Save Format/ });
}

describe('CsvStatementFormatWizardDialog', () => {
  it('analyzes a sample, previews a read-only parse, and saves the created format', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const file = new File(['Date,Memo,Amount,Type'], 'sample.csv', { type: 'text/csv' });

    const { previewMutate } = mockHookDefaults();

    renderWithProviders(
      <CsvStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={onSaved}
      />,
    );

    await analyzeSample(user, file);
    expect(screen.getByText('91%')).toBeInTheDocument();

    await fillRequiredMapping(user);
    await user.clear(screen.getByLabelText('Date format'));
    await user.type(screen.getByLabelText('Date format'), 'MM/dd/uuuu');

    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Coffee')).toBeInTheDocument();
    expect(within(table).getByText('$4.50')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    expect(previewMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        file,
        request: expect.objectContaining({
          accountId: 'checking-001',
          mapping: expect.objectContaining({
            dateColumn: 'Date',
            dateFormat: 'MM/dd/uuuu',
            descriptionColumn: 'Memo',
          }),
        }),
      }),
      expect.any(Object),
    );

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

  it('renders generic preview 422 errors as dialog-level errors', async () => {
    const user = userEvent.setup();
    const file = new File(['Date,Memo,Amount'], 'sample.csv', { type: 'text/csv' });

    mockCurrencies();
    mockWizardMutations({
      previewError: new ApiError(422, {
        type: 'VALIDATION_ERROR',
        message: 'Unable to preview this mapping',
      }),
    });

    renderWithProviders(
      <CsvStatementFormatWizardDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} />,
    );

    await analyzeSample(user, file);
    await fillRequiredMapping(user);
    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));

    expect(await screen.findByText('Unable to preview this mapping')).toBeInTheDocument();
  });

  it('returns save field errors to the mapping controls', async () => {
    const user = userEvent.setup();
    const file = new File(['Date,Memo,Amount,Type'], 'sample.csv', { type: 'text/csv' });

    mockCurrencies();
    mockWizardMutations({
      saveError: new ApiError(422, {
        type: 'VALIDATION_ERROR',
        message: 'Invalid format',
        fieldErrors: [
          {
            field: 'displayName',
            message: 'A statement format with this display name already exists',
          },
        ],
      }),
    });

    renderWithProviders(
      <CsvStatementFormatWizardDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} />,
    );

    await analyzeSample(user, file);
    await fillRequiredMapping(user);
    await previewMapping(user);
    await user.click(screen.getByRole('button', { name: /Save Format/ }));

    expect(await screen.findByLabelText('Display name')).toBeInTheDocument();
    expect(
      screen.getByText('A statement format with this display name already exists'),
    ).toBeInTheDocument();
  });

  it('cancels from upload without calling wizard APIs', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { analyzeMutate, previewMutate, saveMutate } = mockHookDefaults();

    renderWithProviders(
      <CsvStatementFormatWizardDialog open onOpenChange={onOpenChange} onSaved={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(analyzeMutate).not.toHaveBeenCalled();
    expect(previewMutate).not.toHaveBeenCalled();
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it('cancels from mapping without saving', async () => {
    const user = userEvent.setup();
    const file = new File(['Date,Memo,Amount,Type'], 'sample.csv', { type: 'text/csv' });
    const onOpenChange = vi.fn();
    const { saveMutate } = mockHookDefaults();

    renderWithProviders(
      <CsvStatementFormatWizardDialog open onOpenChange={onOpenChange} onSaved={vi.fn()} />,
    );

    await analyzeSample(user, file);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it('cancels from parser preview without saving', async () => {
    const user = userEvent.setup();
    const file = new File(['Date,Memo,Amount,Type'], 'sample.csv', { type: 'text/csv' });
    const onOpenChange = vi.fn();
    const { saveMutate } = mockHookDefaults();

    renderWithProviders(
      <CsvStatementFormatWizardDialog open onOpenChange={onOpenChange} onSaved={vi.fn()} />,
    );

    await analyzeSample(user, file);
    await fillRequiredMapping(user);
    await previewMapping(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it('keeps the parser preview read-only', async () => {
    const user = userEvent.setup();
    const file = new File(['Date,Memo,Amount,Type'], 'sample.csv', { type: 'text/csv' });

    mockHookDefaults();

    renderWithProviders(
      <CsvStatementFormatWizardDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} />,
    );

    await analyzeSample(user, file);
    await fillRequiredMapping(user);
    await previewMapping(user);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Duplicate/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import/ })).not.toBeInTheDocument();
  });

  it('retries analyze with the current file after an error', async () => {
    const user = userEvent.setup();
    const file = new File(['Date,Memo,Amount,Type'], 'sample.csv', { type: 'text/csv' });
    let attempts = 0;
    const analyzeMutate = vi.fn(
      (currentFile: Parameters<AnalyzeMutate>[0], options?: Parameters<AnalyzeMutate>[1]) => {
        attempts += 1;
        if (attempts === 1) {
          options?.onError?.(
            new ApiError(422, {
              type: 'VALIDATION_ERROR',
              message: 'Unable to analyze this file',
            }),
            currentFile,
            undefined,
            undefined as never,
          );
          return;
        }

        options?.onSuccess?.(analysisResponse, currentFile, undefined, undefined as never);
      },
    ) as AnalyzeMutate;

    mockHookDefaults();
    mockUseAnalyzeCsvWizardSample.mockReturnValue({
      mutate: analyzeMutate,
      isPending: false,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useAnalyzeCsvWizardSample>);

    renderWithProviders(
      <CsvStatementFormatWizardDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} />,
    );

    await user.upload(screen.getByLabelText('CSV sample file'), file);
    await user.click(screen.getByRole('button', { name: /Analyze CSV/ }));
    expect(await screen.findByText('Unable to analyze this file')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Analyze CSV/ }));

    expect(await screen.findByText('Sample rows')).toBeInTheDocument();
    expect(analyzeMutate).toHaveBeenNthCalledWith(1, file, expect.any(Object));
    expect(analyzeMutate).toHaveBeenNthCalledWith(2, file, expect.any(Object));
  });

  it('retries preview with the current file and mapping after an error', async () => {
    const user = userEvent.setup();
    const file = new File(['Date,Memo,Amount,Type'], 'sample.csv', { type: 'text/csv' });
    let attempts = 0;
    const previewMutate = vi.fn(
      (variables: Parameters<PreviewMutate>[0], options?: Parameters<PreviewMutate>[1]) => {
        attempts += 1;
        if (attempts === 1) {
          options?.onError?.(
            new ApiError(422, {
              type: 'VALIDATION_ERROR',
              message: 'Unable to preview this mapping',
            }),
            variables,
            undefined,
            undefined as never,
          );
          return;
        }

        options?.onSuccess?.(previewResponse, variables, undefined, undefined as never);
      },
    ) as PreviewMutate;

    mockHookDefaults();
    mockUsePreviewCsvWizardMapping.mockReturnValue({
      mutate: previewMutate,
      isPending: false,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof usePreviewCsvWizardMapping>);

    renderWithProviders(
      <CsvStatementFormatWizardDialog open onOpenChange={vi.fn()} onSaved={vi.fn()} />,
    );

    await analyzeSample(user, file);
    await fillRequiredMapping(user);
    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));
    expect(await screen.findByText('Unable to preview this mapping')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Date format'));
    await user.type(screen.getByLabelText('Date format'), 'yyyy-MM-dd');
    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));

    expect(await screen.findByRole('button', { name: /Save Format/ })).toBeInTheDocument();
    expect(previewMutate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        file,
        request: expect.objectContaining({
          mapping: expect.objectContaining({ dateFormat: 'yyyy-MM-dd' }),
        }),
      }),
      expect.any(Object),
    );
  });
});
