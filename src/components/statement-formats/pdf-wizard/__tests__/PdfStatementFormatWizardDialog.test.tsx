import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PdfStatementFormatWizardDialog } from '@/components/statement-formats/pdf-wizard/PdfStatementFormatWizardDialog';
import {
  useAnalyzePdfWizardSample,
  usePreviewPdfWizardMapping,
  useSavePdfWizardFormat,
} from '@/components/statement-formats/pdf-wizard/hooks/usePdfStatementFormatWizard';
import { useCurrencies } from '@/hooks/useCurrencies';
import { renderWithProviders } from '@/testing/test-utils';
import { ApiError } from '@/types/apiError';
import type {
  PdfWizardAnalysisResponse,
  PdfWizardPreviewResponse,
  StatementFormat,
} from '@/types/statementFormat';

vi.mock('@/hooks/useCurrencies');
vi.mock('@/components/statement-formats/pdf-wizard/hooks/usePdfStatementFormatWizard');

const mockUseCurrencies = vi.mocked(useCurrencies);
const mockUseAnalyzePdfWizardSample = vi.mocked(useAnalyzePdfWizardSample);
const mockUsePreviewPdfWizardMapping = vi.mocked(usePreviewPdfWizardMapping);
const mockUseSavePdfWizardFormat = vi.mocked(useSavePdfWizardFormat);
type AnalyzeMutate = ReturnType<typeof useAnalyzePdfWizardSample>['mutate'];
type PreviewMutate = ReturnType<typeof usePreviewPdfWizardMapping>['mutate'];
type SaveMutate = ReturnType<typeof useSavePdfWizardFormat>['mutate'];

const analysisResponse: PdfWizardAnalysisResponse = {
  candidates: [
    {
      candidateId: 'candidate-1',
      pageNumber: 2,
      rowCount: 12,
      repeatedHeaderCount: 1,
      confidence: 0.62,
      headers: ['Date', 'Memo', 'Amount', 'Type'],
      sampleRows: [['05/01', 'Coffee', '-4.50', 'DEBIT']],
      inferredMapping: {
        dateHeader: 'Date',
        dateFormat: 'MM/dd',
        descriptionHeader: 'Memo',
        amountMode: 'SIGNED_AMOUNT',
        amountHeader: 'Amount',
        typeHeader: 'Type',
        negativeMeans: 'CREDIT',
      },
    },
  ],
};

const previewResponse: PdfWizardPreviewResponse = {
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
  diagnostics: ['Review the parsed rows before saving.'],
};

const analysisResponseWithoutInference: PdfWizardAnalysisResponse = {
  candidates: [
    {
      candidateId: 'candidate-blank',
      pageNumber: 1,
      rowCount: 4,
      repeatedHeaderCount: 0,
      confidence: 0.9,
      headers: ['Posted', 'Details', 'Value'],
      sampleRows: [['05/01', 'Coffee', '-4.50']],
      inferredMapping: {
        amountMode: 'SIGNED_AMOUNT',
      },
    },
  ],
};

const savedFormat: StatementFormat = {
  id: 100,
  displayName: 'Custom Checking PDF',
  formatType: 'PDF',
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

function mockWizardMutations(
  analysis: PdfWizardAnalysisResponse = analysisResponse,
  preview: PdfWizardPreviewResponse = previewResponse,
) {
  const analyzeMutate = vi.fn(
    (file: Parameters<AnalyzeMutate>[0], options?: Parameters<AnalyzeMutate>[1]) => {
      options?.onSuccess?.(analysis, file, undefined, undefined as never);
    },
  ) as AnalyzeMutate;
  const previewMutate = vi.fn(
    (variables: Parameters<PreviewMutate>[0], options?: Parameters<PreviewMutate>[1]) => {
      options?.onSuccess?.(preview, variables, undefined, undefined as never);
    },
  ) as PreviewMutate;
  const saveMutate = vi.fn(
    (variables: Parameters<SaveMutate>[0], options?: Parameters<SaveMutate>[1]) => {
      options?.onSuccess?.(savedFormat, variables, undefined, undefined as never);
    },
  ) as SaveMutate;

  mockUseAnalyzePdfWizardSample.mockReturnValue({
    mutate: analyzeMutate,
    isPending: false,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useAnalyzePdfWizardSample>);
  mockUsePreviewPdfWizardMapping.mockReturnValue({
    mutate: previewMutate,
    isPending: false,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof usePreviewPdfWizardMapping>);
  mockUseSavePdfWizardFormat.mockReturnValue({
    mutate: saveMutate,
    isPending: false,
    reset: vi.fn(),
  } as unknown as ReturnType<typeof useSavePdfWizardFormat>);

  return { previewMutate };
}

function mockHookDefaults(
  analysis?: PdfWizardAnalysisResponse,
  preview?: PdfWizardPreviewResponse,
) {
  mockCurrencies();
  return mockWizardMutations(analysis, preview);
}

async function analyzeAndOpenMapping(user: ReturnType<typeof userEvent.setup>, file: File) {
  await user.upload(screen.getByLabelText('PDF sample file'), file);
  await user.click(screen.getByRole('button', { name: /Analyze PDF/ }));
  await user.click(await screen.findByRole('button', { name: /Continue Mapping/ }));
}

describe('PdfStatementFormatWizardDialog', () => {
  it('opens the mapping step with required markers but no required errors', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });

    mockHookDefaults(analysisResponseWithoutInference);

    renderWithProviders(
      <PdfStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={vi.fn()}
      />,
    );

    await analyzeAndOpenMapping(user, file);

    expect(screen.getAllByText('Required')).toHaveLength(8);
    expect(screen.queryByText('Enter a display name.')).not.toBeInTheDocument();
    expect(screen.queryByText('Select a date column.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Preview Mapping/ })).toBeEnabled();
  });

  it('validates only the blurred empty text field before submit', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });

    mockHookDefaults(analysisResponseWithoutInference);

    renderWithProviders(
      <PdfStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={vi.fn()}
      />,
    );

    await analyzeAndOpenMapping(user, file);
    await user.click(screen.getByLabelText('Display name'));
    await user.tab();

    expect(screen.getByText('Enter a display name.')).toBeInTheDocument();
    expect(screen.queryByText('Enter a bank name.')).not.toBeInTheDocument();
    expect(screen.queryByText('Select a date column.')).not.toBeInTheDocument();
  });

  it('does not reveal every required error when one field is edited', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });

    mockHookDefaults(analysisResponseWithoutInference);

    renderWithProviders(
      <PdfStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={vi.fn()}
      />,
    );

    await analyzeAndOpenMapping(user, file);
    await user.type(screen.getByLabelText('Display name'), 'Custom Checking PDF');

    expect(screen.queryByText('Enter a display name.')).not.toBeInTheDocument();
    expect(screen.queryByText('Enter a bank name.')).not.toBeInTheDocument();
    expect(screen.queryByText('Select a date column.')).not.toBeInTheDocument();
  });

  it('shows all blocking missing-field errors on preview without calling the preview mutation', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });
    const { previewMutate } = mockHookDefaults(analysisResponseWithoutInference);

    renderWithProviders(
      <PdfStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={vi.fn()}
      />,
    );

    await analyzeAndOpenMapping(user, file);
    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));

    expect(screen.getByText('Enter a display name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a bank name.')).toBeInTheDocument();
    expect(screen.getByText('Select a date column.')).toBeInTheDocument();
    expect(screen.getByText('Enter a date format.')).toBeInTheDocument();
    expect(screen.getByText('Select a description column.')).toBeInTheDocument();
    expect(screen.getByText('Select an amount column.')).toBeInTheDocument();
    expect(
      screen.getByText('Choose how negative amounts should be interpreted.'),
    ).toBeInTheDocument();
    expect(previewMutate).not.toHaveBeenCalled();
  });

  it('removes a client-side field error as soon as that field is fixed after preview validation', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });

    mockHookDefaults(analysisResponseWithoutInference);

    renderWithProviders(
      <PdfStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={vi.fn()}
      />,
    );

    await analyzeAndOpenMapping(user, file);
    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));

    expect(screen.getByText('Enter a display name.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Display name'), 'Custom Checking PDF');

    expect(screen.queryByText('Enter a display name.')).not.toBeInTheDocument();
    expect(screen.getByText('Enter a bank name.')).toBeInTheDocument();
  });

  it('analyzes a sample, reviews a candidate, previews a read-only parse, and saves the created format', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });
    const { previewMutate } = mockHookDefaults();

    renderWithProviders(
      <PdfStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={onSaved}
      />,
    );

    await user.upload(screen.getByLabelText('PDF sample file'), file);
    await user.click(screen.getByRole('button', { name: /Analyze PDF/ }));

    await screen.findByRole('button', { name: /Best match/ });
    expect(screen.getByText(/not fully confident/i)).toBeInTheDocument();
    expect(screen.getByText('Coffee')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Continue Mapping/ }));
    await user.type(screen.getByLabelText('Display name'), 'Custom Checking PDF');
    await user.type(screen.getByLabelText('Bank name'), 'Example Bank');
    await user.clear(screen.getByLabelText('Date format'));
    await user.type(screen.getByLabelText('Date format'), 'MM/dd/uuuu');
    await user.click(screen.getByRole('button', { name: 'Negative means money spent' }));
    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Coffee')).toBeInTheDocument();
    expect(screen.getByText('Review the parsed rows before saving.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import/ })).not.toBeInTheDocument();
    expect(previewMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        file,
        request: expect.objectContaining({
          accountId: 'checking-001',
          headerMustContain: ['Date', 'Memo', 'Amount', 'Type'],
          minimumRows: 10,
          mapping: expect.objectContaining({
            dateHeader: 'Date',
            dateFormat: 'MM/dd/uuuu',
            descriptionHeader: 'Memo',
            amountMode: 'SIGNED_AMOUNT',
            amountHeader: 'Amount',
            negativeMeans: 'DEBIT',
          }),
        }),
      }),
      expect.any(Object),
    );

    await user.click(screen.getByRole('button', { name: /Save Format/ }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(savedFormat);
    });
  });

  it('renders an unsupported state when analysis returns rejection reasons', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.7'], 'scan.pdf', { type: 'application/pdf' });

    mockHookDefaults({
      candidates: [],
      rejectionReasons: ['This PDF has no selectable text.'],
    });

    renderWithProviders(
      <PdfStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={vi.fn()}
      />,
    );

    await user.upload(screen.getByLabelText('PDF sample file'), file);
    await user.click(screen.getByRole('button', { name: /Analyze PDF/ }));

    expect(
      await screen.findByText('This PDF cannot be used to create a format'),
    ).toBeInTheDocument();
    expect(screen.getByText('This PDF has no selectable text.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Preview Mapping/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Format/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Choose another file/ }));

    expect(screen.getByLabelText('PDF sample file')).toBeInTheDocument();
    expect(screen.queryByText('Selected file: scan.pdf')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analyze PDF/ })).toBeDisabled();
  });

  it('renders scanned PDF analyze errors as unsupported file guidance', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.7'], 'scan.pdf', { type: 'application/pdf' });
    const analyzeError = new ApiError(422, {
      type: 'APPLICATION_ERROR',
      code: 'PDF_PARSING_ERROR',
      message:
        'PDF does not contain enough extractable text. Scanned or OCR-dependent PDFs are not supported.',
    });
    const analyzeMutate = vi.fn(
      (uploadedFile: Parameters<AnalyzeMutate>[0], options?: Parameters<AnalyzeMutate>[1]) => {
        options?.onError?.(analyzeError, uploadedFile, undefined, undefined as never);
      },
    ) as AnalyzeMutate;

    mockCurrencies();
    mockUseAnalyzePdfWizardSample.mockReturnValue({
      mutate: analyzeMutate,
      isPending: false,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useAnalyzePdfWizardSample>);
    mockUsePreviewPdfWizardMapping.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof usePreviewPdfWizardMapping>);
    mockUseSavePdfWizardFormat.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useSavePdfWizardFormat>);

    renderWithProviders(
      <PdfStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={vi.fn()}
      />,
    );

    await user.upload(screen.getByLabelText('PDF sample file'), file);
    await user.click(screen.getByRole('button', { name: /Analyze PDF/ }));

    expect(
      await screen.findByText('This PDF cannot be used to create a format'),
    ).toBeInTheDocument();
    expect(screen.getByText(/This PDF appears to be scanned/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose another file/ })).toBeInTheDocument();
  });

  it('keeps preview available and validates negative amount direction on click', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });
    const { previewMutate } = mockHookDefaults({
      candidates: [
        {
          ...analysisResponse.candidates![0],
          inferredMapping: {
            dateHeader: 'Date',
            dateFormat: 'MM/dd',
            descriptionHeader: 'Memo',
            amountMode: 'SIGNED_AMOUNT',
            amountHeader: 'Amount',
          },
        },
      ],
    });

    renderWithProviders(
      <PdfStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={vi.fn()}
      />,
    );

    await user.upload(screen.getByLabelText('PDF sample file'), file);
    await user.click(screen.getByRole('button', { name: /Analyze PDF/ }));
    await user.click(await screen.findByRole('button', { name: /Continue Mapping/ }));
    await user.type(screen.getByLabelText('Display name'), 'Custom Checking PDF');
    await user.type(screen.getByLabelText('Bank name'), 'Example Bank');

    expect(
      screen.queryByText('Choose how negative amounts should be interpreted.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Preview Mapping/ })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));

    expect(
      screen.getByText('Choose how negative amounts should be interpreted.'),
    ).toBeInTheDocument();
    expect(previewMutate).not.toHaveBeenCalled();
  });

  it('sends debit and credit headers after switching away from signed amount mode', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });
    const { previewMutate } = mockHookDefaults({
      candidates: [
        {
          ...analysisResponse.candidates![0],
          headers: ['Date', 'Memo', 'Amount', 'Debit', 'Credit'],
          sampleRows: [['05/01', 'Coffee', '-4.50', '4.50', '']],
          inferredMapping: {
            dateHeader: 'Date',
            dateFormat: 'MM/dd',
            descriptionHeader: 'Memo',
            amountMode: 'SIGNED_AMOUNT',
            amountHeader: 'Amount',
            debitHeader: 'Debit',
            creditHeader: 'Credit',
            negativeMeans: 'CREDIT',
          },
        },
      ],
    });

    renderWithProviders(
      <PdfStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={vi.fn()}
      />,
    );

    await analyzeAndOpenMapping(user, file);
    await user.type(screen.getByLabelText('Display name'), 'Custom Checking PDF');
    await user.type(screen.getByLabelText('Bank name'), 'Example Bank');
    await user.clear(screen.getByLabelText('Date format'));
    await user.type(screen.getByLabelText('Date format'), 'MM/dd/uuuu');
    await user.click(screen.getByRole('button', { name: 'Debit and credit columns' }));
    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));

    expect(previewMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          mapping: {
            dateHeader: 'Date',
            dateFormat: 'MM/dd/uuuu',
            descriptionHeader: 'Memo',
            amountMode: 'DEBIT_CREDIT_COLUMNS',
            typeHeader: undefined,
            debitHeader: 'Debit',
            creditHeader: 'Credit',
          },
        }),
      }),
      expect.any(Object),
    );
  });

  it('renders negative-direction field errors beside the direction question', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });
    const previewError = new ApiError(422, {
      type: 'VALIDATION_ERROR',
      message: 'Fix the highlighted fields.',
      fieldErrors: [
        {
          field: 'mapping.negativeMeans',
          message: 'Choose how negative values should be interpreted.',
        },
      ],
    });
    const analyzeMutate = vi.fn(
      (uploadedFile: Parameters<AnalyzeMutate>[0], options?: Parameters<AnalyzeMutate>[1]) => {
        options?.onSuccess?.(analysisResponse, uploadedFile, undefined, undefined as never);
      },
    ) as AnalyzeMutate;
    const previewMutate = vi.fn(
      (variables: Parameters<PreviewMutate>[0], options?: Parameters<PreviewMutate>[1]) => {
        options?.onError?.(previewError, variables, undefined, undefined as never);
      },
    ) as PreviewMutate;

    mockCurrencies();
    mockUseAnalyzePdfWizardSample.mockReturnValue({
      mutate: analyzeMutate,
      isPending: false,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useAnalyzePdfWizardSample>);
    mockUsePreviewPdfWizardMapping.mockReturnValue({
      mutate: previewMutate,
      isPending: false,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof usePreviewPdfWizardMapping>);
    mockUseSavePdfWizardFormat.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useSavePdfWizardFormat>);

    renderWithProviders(
      <PdfStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={vi.fn()}
      />,
    );

    await analyzeAndOpenMapping(user, file);
    await user.type(screen.getByLabelText('Display name'), 'Custom Checking PDF');
    await user.type(screen.getByLabelText('Bank name'), 'Example Bank');
    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));

    expect(
      await screen.findByText('Choose how negative values should be interpreted.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Preview Mapping/ })).toBeInTheDocument();
  });

  it('returns to mapping and renders field errors when save validation fails', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });
    const saveError = new ApiError(422, {
      type: 'VALIDATION_ERROR',
      message: 'Fix the highlighted fields.',
      fieldErrors: [{ field: 'displayName', message: 'Display name is already in use.' }],
    });
    const analyzeMutate = vi.fn(
      (uploadedFile: Parameters<AnalyzeMutate>[0], options?: Parameters<AnalyzeMutate>[1]) => {
        options?.onSuccess?.(analysisResponse, uploadedFile, undefined, undefined as never);
      },
    ) as AnalyzeMutate;
    const previewMutate = vi.fn(
      (variables: Parameters<PreviewMutate>[0], options?: Parameters<PreviewMutate>[1]) => {
        options?.onSuccess?.(previewResponse, variables, undefined, undefined as never);
      },
    ) as PreviewMutate;
    const saveMutate = vi.fn(
      (variables: Parameters<SaveMutate>[0], options?: Parameters<SaveMutate>[1]) => {
        options?.onError?.(saveError, variables, undefined, undefined as never);
      },
    ) as SaveMutate;

    mockCurrencies();
    mockUseAnalyzePdfWizardSample.mockReturnValue({
      mutate: analyzeMutate,
      isPending: false,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useAnalyzePdfWizardSample>);
    mockUsePreviewPdfWizardMapping.mockReturnValue({
      mutate: previewMutate,
      isPending: false,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof usePreviewPdfWizardMapping>);
    mockUseSavePdfWizardFormat.mockReturnValue({
      mutate: saveMutate,
      isPending: false,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useSavePdfWizardFormat>);

    renderWithProviders(
      <PdfStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={vi.fn()}
      />,
    );

    await analyzeAndOpenMapping(user, file);
    await user.type(screen.getByLabelText('Display name'), 'Custom Checking PDF');
    await user.type(screen.getByLabelText('Bank name'), 'Example Bank');
    await user.click(screen.getByRole('button', { name: 'Negative means money spent' }));
    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));
    await screen.findByText('Review the parsed rows before saving.');
    await user.click(screen.getByRole('button', { name: /Save Format/ }));

    expect(await screen.findByLabelText('Display name')).toBeInTheDocument();
    expect(screen.getByText('Display name is already in use.')).toBeInTheDocument();
  });

  it('does not render PDF candidate parser internals', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });

    mockHookDefaults({
      candidates: [
        {
          ...analysisResponse.candidates![0],
          candidateId: 'candidate-secret-42',
          startLineNumber: 9881,
          endLineNumber: 9889,
        },
      ],
    });

    renderWithProviders(
      <PdfStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={vi.fn()}
      />,
    );

    await user.upload(screen.getByLabelText('PDF sample file'), file);
    await user.click(screen.getByRole('button', { name: /Analyze PDF/ }));
    await screen.findByRole('button', { name: /Best match/ });

    expect(screen.queryByText('candidate-secret-42')).not.toBeInTheDocument();
    expect(screen.queryByText('9881')).not.toBeInTheDocument();
    expect(screen.queryByText('9889')).not.toBeInTheDocument();
    expect(screen.queryByText(/regex/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/anchor/i)).not.toBeInTheDocument();
  });

  it('retries preview with the current file and edited mapping after an API error', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });
    const previewError = new ApiError(422, {
      type: 'VALIDATION_ERROR',
      message: 'Unable to preview mapping.',
    });
    let previewCallCount = 0;
    const analyzeMutate = vi.fn(
      (uploadedFile: Parameters<AnalyzeMutate>[0], options?: Parameters<AnalyzeMutate>[1]) => {
        options?.onSuccess?.(analysisResponse, uploadedFile, undefined, undefined as never);
      },
    ) as AnalyzeMutate;
    const previewMutate = vi.fn(
      (variables: Parameters<PreviewMutate>[0], options?: Parameters<PreviewMutate>[1]) => {
        previewCallCount += 1;

        if (previewCallCount === 1) {
          options?.onError?.(previewError, variables, undefined, undefined as never);
          return;
        }

        options?.onSuccess?.(previewResponse, variables, undefined, undefined as never);
      },
    ) as PreviewMutate;

    mockCurrencies();
    mockUseAnalyzePdfWizardSample.mockReturnValue({
      mutate: analyzeMutate,
      isPending: false,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useAnalyzePdfWizardSample>);
    mockUsePreviewPdfWizardMapping.mockReturnValue({
      mutate: previewMutate,
      isPending: false,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof usePreviewPdfWizardMapping>);
    mockUseSavePdfWizardFormat.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useSavePdfWizardFormat>);

    renderWithProviders(
      <PdfStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={vi.fn()}
      />,
    );

    await analyzeAndOpenMapping(user, file);
    await user.type(screen.getByLabelText('Display name'), 'Custom Checking PDF');
    await user.type(screen.getByLabelText('Bank name'), 'Example Bank');
    await user.click(screen.getByRole('button', { name: 'Negative means money spent' }));
    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));

    expect(await screen.findByText('Unable to preview mapping.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Date format'));
    await user.type(screen.getByLabelText('Date format'), 'MM/dd/uuuu');
    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));

    expect(await screen.findByText('Review the parsed rows before saving.')).toBeInTheDocument();
    expect(previewMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        file,
        request: expect.objectContaining({
          mapping: expect.objectContaining({
            dateFormat: 'MM/dd/uuuu',
          }),
        }),
      }),
      expect.any(Object),
    );
  });

  it('hides parser-internal PDF preview diagnostics', async () => {
    const user = userEvent.setup();
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });

    mockHookDefaults(analysisResponse, {
      ...previewResponse,
      diagnostics: [
        'Matched a text-PDF table using 3 configured header token(s).',
        'Review the parsed rows before saving.',
      ],
    });

    renderWithProviders(
      <PdfStatementFormatWizardDialog
        open
        onOpenChange={vi.fn()}
        initialAccountId="checking-001"
        onSaved={vi.fn()}
      />,
    );

    await user.upload(screen.getByLabelText('PDF sample file'), file);
    await user.click(screen.getByRole('button', { name: /Analyze PDF/ }));
    await user.click(await screen.findByRole('button', { name: /Continue Mapping/ }));
    await user.type(screen.getByLabelText('Display name'), 'Custom Checking PDF');
    await user.type(screen.getByLabelText('Bank name'), 'Example Bank');
    await user.click(screen.getByRole('button', { name: 'Negative means money spent' }));
    await user.click(screen.getByRole('button', { name: /Preview Mapping/ }));

    expect(await screen.findByText('Review the parsed rows before saving.')).toBeInTheDocument();
    expect(screen.queryByText(/configured header token/)).not.toBeInTheDocument();
  });
});
