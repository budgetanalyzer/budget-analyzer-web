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

function mockWizardMutations(analysis: PdfWizardAnalysisResponse = analysisResponse) {
  const analyzeMutate = vi.fn(
    (file: Parameters<AnalyzeMutate>[0], options?: Parameters<AnalyzeMutate>[1]) => {
      options?.onSuccess?.(analysis, file, undefined, undefined as never);
    },
  ) as AnalyzeMutate;
  const previewMutate = vi.fn(
    (variables: Parameters<PreviewMutate>[0], options?: Parameters<PreviewMutate>[1]) => {
      options?.onSuccess?.(previewResponse, variables, undefined, undefined as never);
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

function mockHookDefaults(analysis?: PdfWizardAnalysisResponse) {
  mockCurrencies();
  return mockWizardMutations(analysis);
}

describe('PdfStatementFormatWizardDialog', () => {
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
  });
});
