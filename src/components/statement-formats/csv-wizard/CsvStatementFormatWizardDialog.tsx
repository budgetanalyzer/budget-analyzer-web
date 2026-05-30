import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, Upload } from 'lucide-react';
import { ErrorBanner } from '@/components/ErrorBanner';
import { MessageBanner } from '@/components/MessageBanner';
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
import { useCurrencies } from '@/hooks/useCurrencies';
import { ApiError, type FieldError } from '@/types/apiError';
import type {
  CsvWizardAmountMode,
  CsvWizardAnalysisResponse,
  CsvWizardColumnMappingRequest,
  CsvWizardWarningResponse,
  StatementFormat,
} from '@/types/statementFormat';
import { formatApiError } from '@/utils/errorMessages';
import { cn } from '@/utils/cn';
import { CsvWizardReadOnlyPreviewTable } from '@/components/statement-formats/csv-wizard/CsvWizardReadOnlyPreviewTable';
import {
  useAnalyzeCsvWizardSample,
  usePreviewCsvWizardMapping,
  useSaveCsvWizardFormat,
} from '@/components/statement-formats/csv-wizard/hooks/useCsvStatementFormatWizard';
import type { PreviewTransaction } from '@/types/transaction';

type CsvWizardStep = 'upload' | 'mapping' | 'parser-preview';

const DEFAULT_AMOUNT_MODE: CsvWizardAmountMode = 'SINGLE_AMOUNT_WITH_TYPE';
const AMOUNT_MODES: CsvWizardAmountMode[] = ['SINGLE_AMOUNT_WITH_TYPE', 'DEBIT_CREDIT_COLUMNS'];

interface CsvStatementFormatWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

interface WarningListProps {
  warnings: CsvWizardWarningResponse[];
}

function WarningList({ warnings }: WarningListProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
      <ul className="space-y-1">
        {warnings.map((warning, index) => (
          <li key={`${warning.field ?? 'warning'}-${index}`}>
            {warning.field ? `${warning.field}: ` : ''}
            {warning.message ?? 'Review this mapping before continuing.'}
          </li>
        ))}
      </ul>
    </div>
  );
}

function createInitialMapping(analysis: CsvWizardAnalysisResponse): CsvWizardColumnMappingRequest {
  return {
    ...analysis.inferredMapping,
    amountMode: analysis.inferredMapping?.amountMode ?? DEFAULT_AMOUNT_MODE,
  };
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

export function CsvStatementFormatWizardDialog({
  open,
  onOpenChange,
  initialAccountId,
  onSaved,
}: CsvStatementFormatWizardDialogProps) {
  const { data: currencies } = useCurrencies(true);
  const analyzeMutation = useAnalyzeCsvWizardSample();
  const previewMutation = usePreviewCsvWizardMapping();
  const saveMutation = useSaveCsvWizardFormat();

  const [step, setStep] = useState<CsvWizardStep>('upload');
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<CsvWizardColumnMappingRequest>({
    amountMode: DEFAULT_AMOUNT_MODE,
  });
  const [analysisWarnings, setAnalysisWarnings] = useState<CsvWizardWarningResponse[]>([]);
  const [previewWarnings, setPreviewWarnings] = useState<CsvWizardWarningResponse[]>([]);
  const [previewTransactions, setPreviewTransactions] = useState<PreviewTransaction[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [activeError, setActiveError] = useState<Error | null>(null);
  const [formState, setFormState] = useState<WizardFormState>({
    displayName: '',
    bankName: '',
    defaultCurrencyIsoCode: 'USD',
    accountId: initialAccountId ?? '',
  });

  const currencyOptions = useMemo(() => {
    const codes = new Set<string>(['USD']);
    currencies?.forEach((currency) => codes.add(currency.currencyCode));
    return [...codes].sort();
  }, [currencies]);

  const fieldErrors =
    activeError instanceof ApiError ? (activeError.response.fieldErrors ?? []) : [];
  const dialogErrorMessage =
    activeError && !hasOnlyFieldErrors(activeError)
      ? formatApiError(activeError, 'Unable to continue the CSV wizard')
      : null;

  const canPreview =
    sampleFile !== null &&
    formState.displayName.trim() !== '' &&
    formState.bankName.trim() !== '' &&
    formState.defaultCurrencyIsoCode.trim() !== '' &&
    Boolean(mapping.dateColumn) &&
    Boolean(mapping.dateFormat) &&
    Boolean(mapping.descriptionColumn) &&
    (mapping.amountMode === 'SINGLE_AMOUNT_WITH_TYPE'
      ? Boolean(mapping.amountColumn)
      : Boolean(mapping.debitColumn) && Boolean(mapping.creditColumn));

  const canSave = sampleFile !== null && canPreview;
  const isAnalyzePending = analyzeMutation.isPending;
  const isPreviewPending = previewMutation.isPending;
  const isSavePending = saveMutation.isPending;

  const resetWizardState = useCallback(() => {
    setStep('upload');
    setSampleFile(null);
    setHeaders([]);
    setSampleRows([]);
    setMapping({ amountMode: DEFAULT_AMOUNT_MODE });
    setAnalysisWarnings([]);
    setPreviewWarnings([]);
    setPreviewTransactions([]);
    setConfidence(null);
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
  }, [analyzeMutation, initialAccountId, previewMutation, saveMutation]);

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

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSampleFile(event.currentTarget.files?.[0] ?? null);
    setActiveError(null);
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

  const handleAmountModeButtonClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const amountMode = event.currentTarget.value as CsvWizardAmountMode;

    setMapping((current) => ({
      ...current,
      amountMode,
    }));
  }, []);

  const handleDateColumnChange = useCallback((value: string) => {
    setMapping((current) => ({ ...current, dateColumn: normalizeSelectValue(value) }));
  }, []);

  const handleDescriptionColumnChange = useCallback((value: string) => {
    setMapping((current) => ({ ...current, descriptionColumn: normalizeSelectValue(value) }));
  }, []);

  const handleAmountColumnChange = useCallback((value: string) => {
    setMapping((current) => ({ ...current, amountColumn: normalizeSelectValue(value) }));
  }, []);

  const handleDebitColumnChange = useCallback((value: string) => {
    setMapping((current) => ({ ...current, debitColumn: normalizeSelectValue(value) }));
  }, []);

  const handleCreditColumnChange = useCallback((value: string) => {
    setMapping((current) => ({ ...current, creditColumn: normalizeSelectValue(value) }));
  }, []);

  const handleTypeColumnChange = useCallback((value: string) => {
    setMapping((current) => ({ ...current, typeColumn: normalizeSelectValue(value) }));
  }, []);

  const handleCategoryColumnChange = useCallback((value: string) => {
    setMapping((current) => ({ ...current, categoryColumn: normalizeSelectValue(value) }));
  }, []);

  const handleCurrencyChange = useCallback((value: string) => {
    setFormState((current) => ({ ...current, defaultCurrencyIsoCode: value }));
  }, []);

  const handleAnalyze = useCallback(() => {
    if (!sampleFile) return;

    setActiveError(null);
    analyzeMutation.mutate(sampleFile, {
      onSuccess: (analysis) => {
        setHeaders(analysis.headers ?? []);
        setSampleRows(analysis.sampleRows ?? []);
        setMapping(createInitialMapping(analysis));
        setConfidence(analysis.confidence ?? null);
        setAnalysisWarnings(analysis.warnings ?? []);
        setStep('mapping');
      },
      onError: (error) => {
        setActiveError(error);
      },
    });
  }, [analyzeMutation, sampleFile]);

  const handlePreview = useCallback(() => {
    if (!sampleFile || !canPreview) return;

    setActiveError(null);
    previewMutation.mutate(
      {
        file: sampleFile,
        request: {
          bankName: formState.bankName,
          defaultCurrencyIsoCode: formState.defaultCurrencyIsoCode,
          accountId: formState.accountId || undefined,
          mapping,
        },
      },
      {
        onSuccess: (response) => {
          setPreviewTransactions(response.transactions ?? []);
          setPreviewWarnings(response.warnings ?? []);
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
  }, [canPreview, formState, mapping, previewMutation, sampleFile]);

  const handleSave = useCallback(() => {
    if (!sampleFile || !canSave) return;

    setActiveError(null);
    saveMutation.mutate(
      {
        file: sampleFile,
        request: {
          displayName: formState.displayName,
          bankName: formState.bankName,
          defaultCurrencyIsoCode: formState.defaultCurrencyIsoCode,
          mapping,
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
  }, [canSave, formState, mapping, onSaved, resetWizardState, sampleFile, saveMutation]);

  const handleBackToUpload = useCallback(() => {
    setActiveError(null);
    setStep('upload');
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
          <DialogTitle>Create statement format</DialogTitle>
          <DialogDescription>
            Upload a CSV sample, confirm the column mapping, and save it for imports.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-5">
          {dialogErrorMessage ? (
            <MessageBanner type="error" message={dialogErrorMessage} onClose={handleDismissError} />
          ) : null}
          {activeError && !dialogErrorMessage && !hasOnlyFieldErrors(activeError) ? (
            <ErrorBanner error={activeError} />
          ) : null}

          {step === 'upload' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="csv-wizard-file" className="text-sm font-medium">
                  CSV sample file
                </label>
                <Input
                  id="csv-wizard-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                />
              </div>
              {sampleFile ? (
                <p className="text-sm text-muted-foreground">Selected file: {sampleFile.name}</p>
              ) : null}
            </div>
          ) : null}

          {step === 'mapping' ? (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="font-medium">File</p>
                  <p className="text-muted-foreground">{sampleFile?.name}</p>
                </div>
                <div>
                  <p className="font-medium">Headers</p>
                  <p className="text-muted-foreground">{headers.length}</p>
                </div>
                <div>
                  <p className="font-medium">Confidence</p>
                  <p className="text-muted-foreground">
                    {confidence === null ? 'Not provided' : `${Math.round(confidence * 100)}%`}
                  </p>
                </div>
              </div>

              <WarningList warnings={analysisWarnings} />

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Sample rows</h3>
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
                    {sampleRows.map((row, rowIndex) => (
                      <TableRow key={`sample-row-${rowIndex}`}>
                        {headers.map((header) => (
                          <TableCell
                            key={`${rowIndex}-${header}`}
                            className="max-w-[220px] truncate"
                          >
                            {row[header] ?? ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="csv-wizard-display-name" className="text-sm font-medium">
                    Display name
                  </label>
                  <Input
                    id="csv-wizard-display-name"
                    name="displayName"
                    value={formState.displayName}
                    onChange={handleTextFieldChange}
                    maxLength={100}
                    required
                  />
                  <FieldErrorMessage message={getFieldError(fieldErrors, 'displayName')} />
                </div>

                <div className="space-y-2">
                  <label htmlFor="csv-wizard-bank-name" className="text-sm font-medium">
                    Bank name
                  </label>
                  <Input
                    id="csv-wizard-bank-name"
                    name="bankName"
                    value={formState.bankName}
                    onChange={handleTextFieldChange}
                    maxLength={100}
                    required
                  />
                  <FieldErrorMessage message={getFieldError(fieldErrors, 'bankName')} />
                </div>

                <div className="space-y-2">
                  <label htmlFor="csv-wizard-currency" className="text-sm font-medium">
                    Default currency
                  </label>
                  <Select
                    value={formState.defaultCurrencyIsoCode}
                    onValueChange={handleCurrencyChange}
                  >
                    <SelectTrigger id="csv-wizard-currency">
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
                  <label htmlFor="csv-wizard-account-id" className="text-sm font-medium">
                    Account ID
                  </label>
                  <Input
                    id="csv-wizard-account-id"
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
                  id="csv-wizard-date-column"
                  label="Date column"
                  value={mapping.dateColumn}
                  headers={headers}
                  placeholder="Select column"
                  onValueChange={handleDateColumnChange}
                  error={getFieldError(fieldErrors, 'mapping.dateColumn', 'dateColumn')}
                />

                <div className="space-y-2">
                  <label htmlFor="csv-wizard-date-format" className="text-sm font-medium">
                    Date format
                  </label>
                  <Input
                    id="csv-wizard-date-format"
                    name="dateFormat"
                    value={mapping.dateFormat ?? ''}
                    onChange={handleMappingInputChange}
                    maxLength={50}
                    required={Boolean(mapping.dateColumn)}
                    placeholder="MM/dd/uuuu"
                  />
                  <FieldErrorMessage
                    message={getFieldError(fieldErrors, 'mapping.dateFormat', 'dateFormat')}
                  />
                </div>

                <ColumnSelect
                  id="csv-wizard-description-column"
                  label="Description column"
                  value={mapping.descriptionColumn}
                  headers={headers}
                  placeholder="Select column"
                  onValueChange={handleDescriptionColumnChange}
                  error={getFieldError(
                    fieldErrors,
                    'mapping.descriptionColumn',
                    'descriptionColumn',
                  )}
                />

                <ColumnSelect
                  id="csv-wizard-category-column"
                  label="Category column"
                  value={mapping.categoryColumn}
                  headers={headers}
                  placeholder="No column"
                  onValueChange={handleCategoryColumnChange}
                  error={getFieldError(fieldErrors, 'mapping.categoryColumn', 'categoryColumn')}
                />
              </div>

              <div className="space-y-3">
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
                        {amountMode === 'SINGLE_AMOUNT_WITH_TYPE'
                          ? 'Single amount with type'
                          : 'Debit and credit columns'}
                      </Button>
                    ))}
                  </div>
                  <FieldErrorMessage message={getFieldError(fieldErrors, 'mapping.amountMode')} />
                </div>

                {mapping.amountMode === 'SINGLE_AMOUNT_WITH_TYPE' ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <ColumnSelect
                      id="csv-wizard-amount-column"
                      label="Amount column"
                      value={mapping.amountColumn}
                      headers={headers}
                      placeholder="Select column"
                      onValueChange={handleAmountColumnChange}
                      error={getFieldError(fieldErrors, 'mapping.amountColumn', 'amountColumn')}
                    />
                    <ColumnSelect
                      id="csv-wizard-type-column"
                      label="Type column"
                      value={mapping.typeColumn}
                      headers={headers}
                      placeholder="No column"
                      onValueChange={handleTypeColumnChange}
                      error={getFieldError(fieldErrors, 'mapping.typeColumn', 'typeColumn')}
                    />
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <ColumnSelect
                      id="csv-wizard-debit-column"
                      label="Debit column"
                      value={mapping.debitColumn}
                      headers={headers}
                      placeholder="Select column"
                      onValueChange={handleDebitColumnChange}
                      error={getFieldError(fieldErrors, 'mapping.debitColumn', 'debitColumn')}
                    />
                    <ColumnSelect
                      id="csv-wizard-credit-column"
                      label="Credit column"
                      value={mapping.creditColumn}
                      headers={headers}
                      placeholder="Select column"
                      onValueChange={handleCreditColumnChange}
                      error={getFieldError(fieldErrors, 'mapping.creditColumn', 'creditColumn')}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {step === 'parser-preview' ? (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-4">
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
              </div>

              <WarningList warnings={previewWarnings} />

              <CsvWizardReadOnlyPreviewTable transactions={previewTransactions} />
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
                {isAnalyzePending ? 'Analyzing...' : 'Analyze CSV'}
              </Button>
            </>
          ) : null}

          {step === 'mapping' ? (
            <>
              <Button type="button" variant="ghost" onClick={handleBackToUpload}>
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
