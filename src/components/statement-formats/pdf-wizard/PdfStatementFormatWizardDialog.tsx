import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, Upload } from 'lucide-react';
import { ErrorBanner } from '@/components/ErrorBanner';
import { MessageBanner } from '@/components/MessageBanner';
import { StatementFormatWizardReadOnlyPreviewTable } from '@/components/statement-formats/shared/StatementFormatWizardReadOnlyPreviewTable';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import {
  useAnalyzePdfWizardSample,
  usePreviewPdfWizardMapping,
  useSavePdfWizardFormat,
} from '@/components/statement-formats/pdf-wizard/hooks/usePdfStatementFormatWizard';
import { useCurrencies } from '@/hooks/useCurrencies';
import { ApiError, type FieldError } from '@/types/apiError';
import type {
  PdfWizardAmountMode,
  PdfWizardAnalysisResponse,
  PdfWizardColumnMappingRequest,
  PdfWizardNegativeMeans,
  PdfWizardTableCandidateResponse,
  PdfWizardYearSource,
  StatementFormat,
} from '@/types/statementFormat';
import type { PreviewTransaction } from '@/types/transaction';
import { cn } from '@/utils/cn';
import { formatApiError } from '@/utils/errorMessages';

type PdfWizardStep = 'upload' | 'candidate-review' | 'mapping' | 'parser-preview' | 'unsupported';

const DEFAULT_AMOUNT_MODE: PdfWizardAmountMode = 'SIGNED_AMOUNT';
const AMOUNT_MODES: PdfWizardAmountMode[] = ['SIGNED_AMOUNT', 'DEBIT_CREDIT_COLUMNS'];
const NEGATIVE_MEANS_OPTIONS: PdfWizardNegativeMeans[] = ['CREDIT', 'DEBIT'];
const YEAR_SOURCE_OPTIONS: PdfWizardYearSource[] = ['EXPLICIT_DATE', 'STATEMENT_PERIOD'];
const UNSUPPORTED_PDF_ERROR_CODES = new Set([
  'PDF_NO_EXTRACTABLE_TEXT',
  'PDF_SCANNED_OR_OCR_REQUIRED',
  'PDF_NO_TRANSACTION_TABLE',
  'PDF_TABLE_TOO_FEW_ROWS',
  'PDF_TABLE_STRUCTURE_AMBIGUOUS',
]);
const UNSUPPORTED_PDF_MESSAGE_PATTERNS = [
  /scanned/i,
  /ocr/i,
  /no selectable text/i,
  /no extractable text/i,
  /not enough extractable text/i,
  /no transaction table/i,
  /transaction table could not be found/i,
  /too few (valid )?rows/i,
  /ambiguous table/i,
  /ambiguous .*structure/i,
];
const INTERNAL_DIAGNOSTIC_PATTERNS = [
  /pdf_text_table_config/i,
  /parser revision/i,
  /candidate id/i,
  /configured header token/i,
  /header token\(s\)/i,
  /text-pdf table/i,
  /regex/i,
  /anchor/i,
  /coordinate/i,
];

interface PdfStatementFormatWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFile?: File;
  initialAccountId?: string;
  onSaved: (format: StatementFormat) => void;
}

interface WizardFormState {
  displayName: string;
  bankName: string;
  defaultCurrencyIsoCode: string;
  accountId: string;
}

interface FieldErrorMessageProps {
  message?: string;
}

function FieldErrorMessage({ message }: FieldErrorMessageProps) {
  if (!message) return null;

  return <p className="text-sm text-destructive">{message}</p>;
}

interface ColumnSelectProps {
  id: string;
  label: string;
  value?: string;
  headers: string[];
  placeholder: string;
  onValueChange: (value: string) => void;
  error?: string;
}

function ColumnSelect({
  id,
  label,
  value,
  headers,
  placeholder,
  onValueChange,
  error,
}: ColumnSelectProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Select value={value ?? ''} onValueChange={onValueChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-w-[calc(100vw-4rem)]">
          <SelectItem value="">{placeholder}</SelectItem>
          {headers.map((header) => (
            <SelectItem key={header} value={header}>
              {header}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldErrorMessage message={error} />
    </div>
  );
}

interface CandidateSampleTableProps {
  candidate: PdfWizardTableCandidateResponse;
}

function CandidateSampleTable({ candidate }: CandidateSampleTableProps) {
  const headers = candidate.headers ?? [];
  const rows = candidate.sampleRows ?? [];

  if (headers.length === 0 || rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        No sample rows were returned for this candidate.
      </div>
    );
  }

  return (
    <Table className="min-w-[720px]" hideScrollbar={false}>
      <TableHeader>
        <TableRow>
          {headers.map((header) => (
            <TableHead key={header} className="min-w-[140px]">
              {header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => (
          <TableRow key={`pdf-sample-row-${rowIndex}`}>
            {headers.map((header, columnIndex) => (
              <TableCell key={`${rowIndex}-${header}`} className="max-w-[220px] truncate">
                {row[columnIndex] ?? ''}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function normalizeSelectValue(value: string) {
  return value || undefined;
}

function getFieldError(fieldErrors: FieldError[], ...fieldNames: string[]) {
  const match = fieldErrors.find((fieldError) =>
    fieldNames.some(
      (fieldName) =>
        fieldError.field === fieldName ||
        fieldError.field.endsWith(`.${fieldName}`) ||
        fieldName.endsWith(`.${fieldError.field}`),
    ),
  );

  return match?.message;
}

function hasOnlyFieldErrors(error: Error | null) {
  return error instanceof ApiError && (error.response.fieldErrors?.length ?? 0) > 0;
}

function isUnsupportedPdfAnalyzeError(error: Error) {
  if (!(error instanceof ApiError) || error.status !== 422) {
    return false;
  }

  const code = error.response.code;
  const message = error.response.message;

  return (
    (code !== undefined && UNSUPPORTED_PDF_ERROR_CODES.has(code)) ||
    UNSUPPORTED_PDF_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
  );
}

function getUnsupportedPdfErrorReason(error: Error) {
  if (
    error instanceof ApiError &&
    /scanned|ocr|no selectable text|no extractable text/i.test(error.response.message)
  ) {
    return (
      'This PDF appears to be scanned, so there is no selectable text to read. ' +
      'Try a downloaded statement PDF or use a CSV export if your bank provides one.'
    );
  }

  return formatApiError(error, 'This PDF cannot be used to create a format');
}

function isUserFacingDiagnostic(diagnostic: string) {
  return !INTERNAL_DIAGNOSTIC_PATTERNS.some((pattern) => pattern.test(diagnostic));
}

function createInitialMapping(
  candidate: PdfWizardTableCandidateResponse,
): PdfWizardColumnMappingRequest {
  return {
    ...candidate.inferredMapping,
    amountMode: candidate.inferredMapping?.amountMode ?? DEFAULT_AMOUNT_MODE,
  };
}

function sanitizeMapping(mapping: PdfWizardColumnMappingRequest): PdfWizardColumnMappingRequest {
  const common = {
    dateHeader: mapping.dateHeader,
    dateFormat: mapping.dateFormat,
    descriptionHeader: mapping.descriptionHeader,
    amountMode: mapping.amountMode,
    typeHeader: mapping.typeHeader,
  };

  if (mapping.amountMode === 'DEBIT_CREDIT_COLUMNS') {
    return {
      ...common,
      debitHeader: mapping.debitHeader,
      creditHeader: mapping.creditHeader,
    };
  }

  return {
    ...common,
    amountHeader: mapping.amountHeader,
    negativeMeans: mapping.negativeMeans,
  };
}

function deriveHeaderMustContain(
  candidate: PdfWizardTableCandidateResponse,
  mapping: PdfWizardColumnMappingRequest,
) {
  const candidateHeaders = new Set(candidate.headers ?? []);
  const mappedHeaders = [
    mapping.dateHeader,
    mapping.descriptionHeader,
    mapping.amountHeader,
    mapping.debitHeader,
    mapping.creditHeader,
    mapping.typeHeader,
  ];

  return [...new Set(mappedHeaders.filter((header): header is string => Boolean(header)))]
    .filter((header) => candidateHeaders.has(header))
    .slice(0, 6);
}

function deriveMinimumRows(candidate: PdfWizardTableCandidateResponse) {
  return Math.min(Math.max(candidate.rowCount ?? 3, 1), 10);
}

function getCandidateLabel(index: number) {
  return index === 0 ? 'Best match' : `Option ${index + 1}`;
}

function formatConfidence(confidence?: number) {
  return confidence === undefined ? 'Not provided' : `${Math.round(confidence * 100)}%`;
}

export function PdfStatementFormatWizardDialog({
  open,
  onOpenChange,
  initialFile,
  initialAccountId,
  onSaved,
}: PdfStatementFormatWizardDialogProps) {
  const { data: currencies } = useCurrencies(true);
  const analyzeMutation = useAnalyzePdfWizardSample();
  const previewMutation = usePreviewPdfWizardMapping();
  const saveMutation = useSavePdfWizardFormat();

  const [step, setStep] = useState<PdfWizardStep>('upload');
  const [sampleFile, setSampleFile] = useState<File | null>(initialFile ?? null);
  const [candidates, setCandidates] = useState<PdfWizardTableCandidateResponse[]>([]);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const [mapping, setMapping] = useState<PdfWizardColumnMappingRequest>({
    amountMode: DEFAULT_AMOUNT_MODE,
  });
  const [minimumRows, setMinimumRows] = useState(3);
  const [yearSource, setYearSource] = useState<PdfWizardYearSource>('EXPLICIT_DATE');
  const [previewDiagnostics, setPreviewDiagnostics] = useState<string[]>([]);
  const [previewTransactions, setPreviewTransactions] = useState<PreviewTransaction[]>([]);
  const [unsupportedReasons, setUnsupportedReasons] = useState<string[]>([]);
  const [activeError, setActiveError] = useState<Error | null>(null);
  const [formState, setFormState] = useState<WizardFormState>({
    displayName: '',
    bankName: '',
    defaultCurrencyIsoCode: 'USD',
    accountId: initialAccountId ?? '',
  });

  const selectedCandidate = candidates[selectedCandidateIndex];
  const headers = selectedCandidate?.headers ?? [];
  const fieldErrors =
    activeError instanceof ApiError ? (activeError.response.fieldErrors ?? []) : [];
  const dialogErrorMessage =
    activeError && !hasOnlyFieldErrors(activeError)
      ? formatApiError(activeError, 'Unable to continue the PDF wizard')
      : null;

  const currencyOptions = useMemo(() => {
    const codes = new Set<string>(['USD']);
    currencies?.forEach((currency) => codes.add(currency.currencyCode));
    return [...codes].sort();
  }, [currencies]);

  const canPreview =
    sampleFile !== null &&
    selectedCandidate !== undefined &&
    formState.displayName.trim() !== '' &&
    formState.bankName.trim() !== '' &&
    formState.defaultCurrencyIsoCode.trim() !== '' &&
    Boolean(mapping.dateHeader) &&
    Boolean(mapping.dateFormat) &&
    Boolean(mapping.descriptionHeader) &&
    (mapping.amountMode === 'SIGNED_AMOUNT'
      ? Boolean(mapping.amountHeader) && Boolean(mapping.negativeMeans)
      : Boolean(mapping.debitHeader) && Boolean(mapping.creditHeader));

  const canSave = sampleFile !== null && canPreview;
  const isAnalyzePending = analyzeMutation.isPending;
  const isPreviewPending = previewMutation.isPending;
  const isSavePending = saveMutation.isPending;

  const resetWizardState = useCallback(() => {
    setStep('upload');
    setSampleFile(initialFile ?? null);
    setCandidates([]);
    setSelectedCandidateIndex(0);
    setMapping({ amountMode: DEFAULT_AMOUNT_MODE });
    setMinimumRows(3);
    setYearSource('EXPLICIT_DATE');
    setPreviewDiagnostics([]);
    setPreviewTransactions([]);
    setUnsupportedReasons([]);
    setActiveError(null);
    setFormState({
      displayName: '',
      bankName: '',
      defaultCurrencyIsoCode: 'USD',
      accountId: initialAccountId ?? '',
    });
    analyzeMutation.reset();
    previewMutation.reset();
    saveMutation.reset();
  }, [analyzeMutation, initialAccountId, initialFile, previewMutation, saveMutation]);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetWizardState();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetWizardState],
  );

  const handleDismissError = useCallback(() => {
    setActiveError(null);
  }, []);

  const applyCandidate = useCallback((candidate: PdfWizardTableCandidateResponse) => {
    const nextMapping = createInitialMapping(candidate);
    setMapping(nextMapping);
    setMinimumRows(deriveMinimumRows(candidate));
    setYearSource('EXPLICIT_DATE');
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSampleFile(event.currentTarget.files?.[0] ?? null);
    setActiveError(null);
    setUnsupportedReasons([]);
  }, []);

  const handleTextFieldChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.currentTarget;

    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
  }, []);

  const handleMappingInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.currentTarget;

    setMapping((current) => ({
      ...current,
      [name]: value || undefined,
    }));
  }, []);

  const handleCurrencyChange = useCallback((value: string) => {
    setFormState((current) => ({ ...current, defaultCurrencyIsoCode: value }));
  }, []);

  const handleDateHeaderChange = useCallback((value: string) => {
    setMapping((current) => ({ ...current, dateHeader: normalizeSelectValue(value) }));
  }, []);

  const handleDescriptionHeaderChange = useCallback((value: string) => {
    setMapping((current) => ({ ...current, descriptionHeader: normalizeSelectValue(value) }));
  }, []);

  const handleAmountHeaderChange = useCallback((value: string) => {
    setMapping((current) => ({ ...current, amountHeader: normalizeSelectValue(value) }));
  }, []);

  const handleDebitHeaderChange = useCallback((value: string) => {
    setMapping((current) => ({ ...current, debitHeader: normalizeSelectValue(value) }));
  }, []);

  const handleCreditHeaderChange = useCallback((value: string) => {
    setMapping((current) => ({ ...current, creditHeader: normalizeSelectValue(value) }));
  }, []);

  const handleTypeHeaderChange = useCallback((value: string) => {
    setMapping((current) => ({ ...current, typeHeader: normalizeSelectValue(value) }));
  }, []);

  const handleAmountModeButtonClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const amountMode = event.currentTarget.value as PdfWizardAmountMode;

    setMapping((current) => ({
      ...current,
      amountMode,
    }));
  }, []);

  const handleYearSourceButtonClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setYearSource(event.currentTarget.value as PdfWizardYearSource);
  }, []);

  const handleNegativeMeansButtonClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const negativeMeans = event.currentTarget.value as PdfWizardNegativeMeans;

      setMapping((current) => ({
        ...current,
        negativeMeans,
      }));
    },
    [],
  );

  const handleAnalyze = useCallback(() => {
    if (!sampleFile) return;

    setActiveError(null);
    setUnsupportedReasons([]);
    analyzeMutation.mutate(sampleFile, {
      onSuccess: (analysis: PdfWizardAnalysisResponse) => {
        const nextCandidates = analysis.candidates ?? [];

        if (nextCandidates.length === 0) {
          setUnsupportedReasons(
            analysis.rejectionReasons?.length
              ? analysis.rejectionReasons
              : ['No transaction table could be found in this PDF.'],
          );
          setStep('unsupported');
          return;
        }

        setCandidates(nextCandidates);
        setSelectedCandidateIndex(0);
        applyCandidate(nextCandidates[0]);
        setStep('candidate-review');
      },
      onError: (error) => {
        setActiveError(error);

        if (isUnsupportedPdfAnalyzeError(error)) {
          setUnsupportedReasons([getUnsupportedPdfErrorReason(error)]);
          setStep('unsupported');
        }
      },
    });
  }, [analyzeMutation, applyCandidate, sampleFile]);

  const handleCandidateButtonClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const nextIndex = Number(event.currentTarget.value);
      const candidate = candidates[nextIndex];

      if (!candidate) return;

      setSelectedCandidateIndex(nextIndex);
      applyCandidate(candidate);
      setActiveError(null);
    },
    [applyCandidate, candidates],
  );

  const handleContinueMapping = useCallback(() => {
    setActiveError(null);
    setStep('mapping');
  }, []);

  const handlePreview = useCallback(() => {
    if (!sampleFile || !selectedCandidate || !canPreview) return;

    const requestMapping = sanitizeMapping(mapping);
    const requestHeaderMustContain = deriveHeaderMustContain(selectedCandidate, requestMapping);

    setActiveError(null);
    previewMutation.mutate(
      {
        file: sampleFile,
        request: {
          bankName: formState.bankName,
          defaultCurrencyIsoCode: formState.defaultCurrencyIsoCode,
          accountId: formState.accountId || undefined,
          headerMustContain: requestHeaderMustContain,
          minimumRows,
          yearSource,
          mapping: requestMapping,
        },
      },
      {
        onSuccess: (response) => {
          setPreviewTransactions(response.transactions ?? []);
          setPreviewDiagnostics((response.diagnostics ?? []).filter(isUserFacingDiagnostic));
          setStep('parser-preview');
        },
        onError: (error) => {
          setActiveError(error);
          if (error.response.fieldErrors?.length) {
            setStep('mapping');
          }
        },
      },
    );
  }, [
    canPreview,
    formState,
    mapping,
    minimumRows,
    previewMutation,
    sampleFile,
    selectedCandidate,
    yearSource,
  ]);

  const handleSave = useCallback(() => {
    if (!sampleFile || !selectedCandidate || !canSave) return;

    const requestMapping = sanitizeMapping(mapping);
    const requestHeaderMustContain = deriveHeaderMustContain(selectedCandidate, requestMapping);

    setActiveError(null);
    saveMutation.mutate(
      {
        file: sampleFile,
        request: {
          displayName: formState.displayName,
          bankName: formState.bankName,
          defaultCurrencyIsoCode: formState.defaultCurrencyIsoCode,
          headerMustContain: requestHeaderMustContain,
          minimumRows,
          yearSource,
          mapping: requestMapping,
        },
      },
      {
        onSuccess: (createdFormat) => {
          onSaved(createdFormat);
          resetWizardState();
        },
        onError: (error) => {
          setActiveError(error);
          if (error.response.fieldErrors?.length) {
            setStep('mapping');
          }
        },
      },
    );
  }, [
    canSave,
    formState,
    mapping,
    minimumRows,
    onSaved,
    resetWizardState,
    sampleFile,
    saveMutation,
    selectedCandidate,
    yearSource,
  ]);

  const handleBackToUpload = useCallback(() => {
    setActiveError(null);
    setStep('upload');
  }, []);

  const handleChooseAnotherFile = useCallback(() => {
    setActiveError(null);
    setUnsupportedReasons([]);
    setSampleFile(null);
    setCandidates([]);
    setSelectedCandidateIndex(0);
    setMapping({ amountMode: DEFAULT_AMOUNT_MODE });
    setPreviewDiagnostics([]);
    setPreviewTransactions([]);
    setStep('upload');
  }, []);

  const handleBackToCandidates = useCallback(() => {
    setActiveError(null);
    setStep('candidate-review');
  }, []);

  const handleBackToMapping = useCallback(() => {
    setActiveError(null);
    setStep('mapping');
  }, []);

  const handleCancel = useCallback(() => {
    handleDialogOpenChange(false);
  }, [handleDialogOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create PDF statement format</DialogTitle>
          <DialogDescription>
            Upload a text-based PDF sample, confirm the table and mapping, and save it for imports.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-5">
          {dialogErrorMessage && step !== 'unsupported' ? (
            <MessageBanner type="error" message={dialogErrorMessage} onClose={handleDismissError} />
          ) : null}
          {activeError && !dialogErrorMessage && !hasOnlyFieldErrors(activeError) ? (
            <ErrorBanner error={activeError} />
          ) : null}

          {step === 'upload' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="pdf-wizard-file" className="text-sm font-medium">
                  PDF sample file
                </label>
                <Input
                  id="pdf-wizard-file"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                />
              </div>
              {sampleFile ? (
                <p className="text-sm text-muted-foreground">Selected file: {sampleFile.name}</p>
              ) : null}
            </div>
          ) : null}

          {step === 'unsupported' ? (
            <div className="space-y-4">
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
                <h3 className="font-medium text-destructive">
                  This PDF cannot be used to create a format
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-destructive">
                  {unsupportedReasons.map((reason, index) => (
                    <li key={`unsupported-${index}`}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {step === 'candidate-review' && selectedCandidate ? (
            <div className="space-y-5">
              <div className="grid gap-2 sm:grid-cols-3">
                {candidates.map((candidate, index) => (
                  <Button
                    key={candidate.candidateId ?? `candidate-${index}`}
                    type="button"
                    value={index}
                    variant={selectedCandidateIndex === index ? 'default' : 'outline'}
                    onClick={handleCandidateButtonClick}
                    className="h-auto justify-start whitespace-normal"
                  >
                    <span>
                      <span className="block font-medium">{getCandidateLabel(index)}</span>
                      <span className="block text-xs">
                        Page {candidate.pageNumber ?? 'unknown'} · {candidate.rowCount ?? 0} rows ·{' '}
                        {formatConfidence(candidate.confidence)}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>

              {(selectedCandidate.confidence ?? 1) < 0.7 ? (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                  We are not fully confident this is the transaction table. Review the rows and
                  mapping before previewing.
                </div>
              ) : null}

              <div className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="font-medium">Candidate</p>
                  <p className="text-muted-foreground">
                    {getCandidateLabel(selectedCandidateIndex)}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Page</p>
                  <p className="text-muted-foreground">
                    {selectedCandidate.pageNumber ?? 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Rows</p>
                  <p className="text-muted-foreground">{selectedCandidate.rowCount ?? 0}</p>
                </div>
                <div>
                  <p className="font-medium">Repeated headers</p>
                  <p className="text-muted-foreground">
                    {selectedCandidate.repeatedHeaderCount ?? 0}
                  </p>
                </div>
              </div>

              <CandidateSampleTable candidate={selectedCandidate} />
            </div>
          ) : null}

          {step === 'mapping' && selectedCandidate ? (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="font-medium">File</p>
                  <p className="text-muted-foreground">{sampleFile?.name}</p>
                </div>
                <div>
                  <p className="font-medium">Candidate</p>
                  <p className="text-muted-foreground">
                    {getCandidateLabel(selectedCandidateIndex)}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Page</p>
                  <p className="text-muted-foreground">
                    {selectedCandidate.pageNumber ?? 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Confidence</p>
                  <p className="text-muted-foreground">
                    {formatConfidence(selectedCandidate.confidence)}
                  </p>
                </div>
              </div>

              <CandidateSampleTable candidate={selectedCandidate} />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="pdf-wizard-display-name" className="text-sm font-medium">
                    Display name
                  </label>
                  <Input
                    id="pdf-wizard-display-name"
                    name="displayName"
                    value={formState.displayName}
                    onChange={handleTextFieldChange}
                    maxLength={100}
                    required
                  />
                  <FieldErrorMessage message={getFieldError(fieldErrors, 'displayName')} />
                </div>

                <div className="space-y-2">
                  <label htmlFor="pdf-wizard-bank-name" className="text-sm font-medium">
                    Bank name
                  </label>
                  <Input
                    id="pdf-wizard-bank-name"
                    name="bankName"
                    value={formState.bankName}
                    onChange={handleTextFieldChange}
                    maxLength={100}
                    required
                  />
                  <FieldErrorMessage message={getFieldError(fieldErrors, 'bankName')} />
                </div>

                <div className="space-y-2">
                  <label htmlFor="pdf-wizard-currency" className="text-sm font-medium">
                    Default currency
                  </label>
                  <Select
                    value={formState.defaultCurrencyIsoCode}
                    onValueChange={handleCurrencyChange}
                  >
                    <SelectTrigger id="pdf-wizard-currency">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((currencyCode) => (
                        <SelectItem key={currencyCode} value={currencyCode}>
                          {currencyCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldErrorMessage
                    message={getFieldError(fieldErrors, 'defaultCurrencyIsoCode')}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="pdf-wizard-account-id" className="text-sm font-medium">
                    Account ID
                  </label>
                  <Input
                    id="pdf-wizard-account-id"
                    name="accountId"
                    value={formState.accountId}
                    onChange={handleTextFieldChange}
                    maxLength={100}
                    placeholder="Optional parser preview value"
                  />
                  <FieldErrorMessage message={getFieldError(fieldErrors, 'accountId')} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <ColumnSelect
                  id="pdf-wizard-date-header"
                  label="Date column"
                  value={mapping.dateHeader}
                  headers={headers}
                  placeholder="Select column"
                  onValueChange={handleDateHeaderChange}
                  error={getFieldError(fieldErrors, 'mapping.dateHeader', 'dateHeader')}
                />

                <div className="space-y-2">
                  <label htmlFor="pdf-wizard-date-format" className="text-sm font-medium">
                    Date format
                  </label>
                  <Input
                    id="pdf-wizard-date-format"
                    name="dateFormat"
                    value={mapping.dateFormat ?? ''}
                    onChange={handleMappingInputChange}
                    maxLength={50}
                    required={Boolean(mapping.dateHeader)}
                    placeholder="MM/dd/uuuu"
                  />
                  <FieldErrorMessage
                    message={getFieldError(fieldErrors, 'mapping.dateFormat', 'dateFormat')}
                  />
                </div>

                <ColumnSelect
                  id="pdf-wizard-description-header"
                  label="Description column"
                  value={mapping.descriptionHeader}
                  headers={headers}
                  placeholder="Select column"
                  onValueChange={handleDescriptionHeaderChange}
                  error={getFieldError(
                    fieldErrors,
                    'mapping.descriptionHeader',
                    'descriptionHeader',
                  )}
                />

                <ColumnSelect
                  id="pdf-wizard-type-header"
                  label="Type column"
                  value={mapping.typeHeader}
                  headers={headers}
                  placeholder="No column"
                  onValueChange={handleTypeHeaderChange}
                  error={getFieldError(fieldErrors, 'mapping.typeHeader', 'typeHeader')}
                />
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Statement date year</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {YEAR_SOURCE_OPTIONS.map((nextYearSource) => (
                      <Button
                        key={nextYearSource}
                        type="button"
                        value={nextYearSource}
                        variant={yearSource === nextYearSource ? 'default' : 'outline'}
                        onClick={handleYearSourceButtonClick}
                        className={cn('justify-center', 'h-auto min-h-10 whitespace-normal')}
                      >
                        {nextYearSource === 'EXPLICIT_DATE'
                          ? 'Dates include a year'
                          : 'Use the statement period'}
                      </Button>
                    ))}
                  </div>
                  <FieldErrorMessage message={getFieldError(fieldErrors, 'yearSource')} />
                </div>

                <div>
                  <p className="text-sm font-medium">Amount mode</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {AMOUNT_MODES.map((amountMode) => (
                      <Button
                        key={amountMode}
                        type="button"
                        value={amountMode}
                        variant={mapping.amountMode === amountMode ? 'default' : 'outline'}
                        onClick={handleAmountModeButtonClick}
                        className={cn('justify-center', 'h-auto min-h-10 whitespace-normal')}
                      >
                        {amountMode === 'SIGNED_AMOUNT'
                          ? 'Signed amount column'
                          : 'Debit and credit columns'}
                      </Button>
                    ))}
                  </div>
                  <FieldErrorMessage message={getFieldError(fieldErrors, 'mapping.amountMode')} />
                </div>

                {mapping.amountMode === 'SIGNED_AMOUNT' ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <ColumnSelect
                      id="pdf-wizard-amount-header"
                      label="Amount column"
                      value={mapping.amountHeader}
                      headers={headers}
                      placeholder="Select column"
                      onValueChange={handleAmountHeaderChange}
                      error={getFieldError(fieldErrors, 'mapping.amountHeader', 'amountHeader')}
                    />

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Negative amount meaning</p>
                      {!mapping.negativeMeans ? (
                        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                          Choose how negative amounts should be treated before previewing.
                        </div>
                      ) : null}
                      <div className="grid gap-2">
                        {NEGATIVE_MEANS_OPTIONS.map((negativeMeans) => (
                          <Button
                            key={negativeMeans}
                            type="button"
                            value={negativeMeans}
                            variant={
                              mapping.negativeMeans === negativeMeans ? 'default' : 'outline'
                            }
                            onClick={handleNegativeMeansButtonClick}
                            className="h-auto justify-start whitespace-normal"
                          >
                            {negativeMeans === 'CREDIT'
                              ? 'Negative means money received'
                              : 'Negative means money spent'}
                          </Button>
                        ))}
                      </div>
                      <FieldErrorMessage
                        message={getFieldError(
                          fieldErrors,
                          'mapping.negativeMeans',
                          'negativeMeans',
                        )}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <ColumnSelect
                      id="pdf-wizard-debit-header"
                      label="Debit column"
                      value={mapping.debitHeader}
                      headers={headers}
                      placeholder="Select column"
                      onValueChange={handleDebitHeaderChange}
                      error={getFieldError(fieldErrors, 'mapping.debitHeader', 'debitHeader')}
                    />
                    <ColumnSelect
                      id="pdf-wizard-credit-header"
                      label="Credit column"
                      value={mapping.creditHeader}
                      headers={headers}
                      placeholder="Select column"
                      onValueChange={handleCreditHeaderChange}
                      error={getFieldError(fieldErrors, 'mapping.creditHeader', 'creditHeader')}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {step === 'parser-preview' && selectedCandidate ? (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-5">
                <div>
                  <p className="font-medium">Display name</p>
                  <p className="text-muted-foreground">{formState.displayName}</p>
                </div>
                <div>
                  <p className="font-medium">Bank</p>
                  <p className="text-muted-foreground">{formState.bankName}</p>
                </div>
                <div>
                  <p className="font-medium">Currency</p>
                  <p className="text-muted-foreground">{formState.defaultCurrencyIsoCode}</p>
                </div>
                <div>
                  <p className="font-medium">File</p>
                  <p className="text-muted-foreground">{sampleFile?.name}</p>
                </div>
                <div>
                  <p className="font-medium">Candidate</p>
                  <p className="text-muted-foreground">
                    {getCandidateLabel(selectedCandidateIndex)}
                  </p>
                </div>
              </div>

              {previewDiagnostics.length > 0 ? (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                  <ul className="space-y-1">
                    {previewDiagnostics.map((diagnostic, index) => (
                      <li key={`pdf-diagnostic-${index}`}>{diagnostic}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <StatementFormatWizardReadOnlyPreviewTable transactions={previewTransactions} />
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-6 gap-2">
          {step === 'upload' ? (
            <>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleAnalyze}
                disabled={!sampleFile || isAnalyzePending}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isAnalyzePending ? 'Analyzing...' : 'Analyze PDF'}
              </Button>
            </>
          ) : null}

          {step === 'unsupported' ? (
            <>
              <Button type="button" onClick={handleChooseAnotherFile}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Choose another file
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </>
          ) : null}

          {step === 'candidate-review' ? (
            <>
              <Button type="button" variant="ghost" onClick={handleBackToUpload}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="button" onClick={handleContinueMapping}>
                Continue Mapping
              </Button>
            </>
          ) : null}

          {step === 'mapping' ? (
            <>
              <Button type="button" variant="ghost" onClick={handleBackToCandidates}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handlePreview}
                disabled={!canPreview || isPreviewPending}
              >
                {isPreviewPending ? 'Previewing...' : 'Preview Mapping'}
              </Button>
            </>
          ) : null}

          {step === 'parser-preview' ? (
            <>
              <Button type="button" variant="ghost" onClick={handleBackToMapping}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={!canSave || isSavePending}>
                {isSavePending ? 'Saving...' : 'Save Format'}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
