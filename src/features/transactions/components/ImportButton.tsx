// src/features/transactions/components/ImportButton.tsx
import { useRef, useState, useCallback, useMemo } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MessageBanner } from '@/components/MessageBanner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { usePreviewTransactions } from '@/features/transactions/hooks/usePreviewTransactions';
import { TransactionPreviewModal } from '@/features/transactions/components/TransactionPreviewModal';
import { motion, AnimatePresence } from 'framer-motion';
import { collapseFromRightVariants, collapseTransition } from '@/lib/animations';
import { PreviewResponse } from '@/types/transaction';
import { useStatementFormats } from '@/hooks/useStatementFormats';
import { useCurrencies } from '@/hooks/useCurrencies';
import { CsvStatementFormatWizardDialog } from '@/components/statement-formats/csv-wizard/CsvStatementFormatWizardDialog';
import type { StatementFormat } from '@/types/statementFormat';

const CREATE_FORMAT_SELECT_VALUE = '__create_statement_format__';

interface ImportButtonProps {
  onSuccess?: (created: number, duplicatesSkipped: number, duplicatesImported: number) => void;
  onError?: (error: Error) => void;
  onExpandedChange?: (expanded: boolean) => void;
}

interface PreviewModalState {
  isOpen: boolean;
  previewData: PreviewResponse | null;
}

export function ImportButton({ onSuccess, onError, onExpandedChange }: ImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate: previewTransactions, isPending } = usePreviewTransactions();
  const {
    data: statementFormats,
    isLoading: isLoadingFormats,
    isError: isFormatsError,
  } = useStatementFormats();
  const { data: enabledCurrencies } = useCurrencies(true);
  const [isExpanded, setIsExpandedState] = useState(false);
  const [isCsvWizardOpen, setIsCsvWizardOpen] = useState(false);

  const setIsExpanded = useCallback(
    (expanded: boolean) => {
      setIsExpandedState(expanded);
      onExpandedChange?.(expanded);
    },
    [onExpandedChange],
  );
  const [selectedStatementFormatId, setSelectedStatementFormatId] = useState<number | null>(null);
  const [savedStatementFormat, setSavedStatementFormat] = useState<StatementFormat | null>(null);
  const [savedFormatMessage, setSavedFormatMessage] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewModal, setPreviewModal] = useState<PreviewModalState>({
    isOpen: false,
    previewData: null,
  });

  // Build set of enabled currency codes (USD always available)
  const enabledCurrencyCodes = useMemo(() => {
    const codes = new Set<string>(['USD']);
    enabledCurrencies?.forEach((c) => codes.add(c.currencyCode));
    return codes;
  }, [enabledCurrencies]);

  // Filter to only enabled formats with enabled currencies, then sort for display
  const enabledFormats = useMemo(() => {
    const formats = Array.isArray(statementFormats) ? [...statementFormats] : [];
    if (savedStatementFormat && !formats.some((f) => f.id === savedStatementFormat.id)) {
      formats.push(savedStatementFormat);
    }

    return formats
      .filter((f) => f.enabled && enabledCurrencyCodes.has(f.defaultCurrencyIsoCode))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [statementFormats, savedStatementFormat, enabledCurrencyCodes]);

  const duplicateDisplayNames = useMemo(() => {
    const counts = new Map<string, number>();
    enabledFormats.forEach((statementFormat) => {
      counts.set(statementFormat.displayName, (counts.get(statementFormat.displayName) ?? 0) + 1);
    });

    return new Set(
      [...counts.entries()].filter(([, count]) => count > 1).map(([displayName]) => displayName),
    );
  }, [enabledFormats]);

  const getFormatSourceLabel = useCallback((statementFormat: StatementFormat) => {
    if (statementFormat.scope === 'USER') return 'Custom';
    if (statementFormat.scope === 'SYSTEM') return 'System';
    return null;
  }, []);

  const getFormatDisplayLabel = useCallback(
    (statementFormat: StatementFormat) => {
      const sourceLabel = duplicateDisplayNames.has(statementFormat.displayName)
        ? getFormatSourceLabel(statementFormat)
        : null;

      return sourceLabel
        ? `${statementFormat.displayName} ${sourceLabel}`
        : statementFormat.displayName;
    },
    [duplicateDisplayNames, getFormatSourceLabel],
  );

  const renderFormatSelectLabel = useCallback(
    (statementFormat: StatementFormat) => {
      const sourceLabel = duplicateDisplayNames.has(statementFormat.displayName)
        ? getFormatSourceLabel(statementFormat)
        : null;

      return (
        <span className="flex w-full items-center justify-between gap-3">
          <span>{statementFormat.displayName}</span>
          {sourceLabel ? (
            <span className="text-xs text-muted-foreground">{sourceLabel}</span>
          ) : null}
        </span>
      );
    },
    [duplicateDisplayNames, getFormatSourceLabel],
  );

  const selectedFormat = enabledFormats.find((f) => f.id === selectedStatementFormatId);
  const selectedLabel = selectedFormat ? getFormatDisplayLabel(selectedFormat) : null;

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  }, []);

  const clearForm = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSelectedFile(null);
    setSelectedStatementFormatId(null);
    setSavedFormatMessage(null);
    setAccountId('');
    setIsExpanded(false);
  }, [setIsExpanded]);

  const handleSubmit = useCallback(() => {
    if (!selectedFile || selectedStatementFormatId === null) {
      return;
    }

    setSavedFormatMessage(null);

    // All formats now use the preview workflow
    previewTransactions(
      {
        file: selectedFile,
        statementFormatId: selectedStatementFormatId,
        accountId: accountId || undefined,
      },
      {
        onSuccess: (data) => {
          clearForm();
          setPreviewModal({
            isOpen: true,
            previewData: data,
          });
        },
        onError: (error) => {
          onError?.(error);
        },
      },
    );
  }, [selectedFile, selectedStatementFormatId, accountId, previewTransactions, clearForm, onError]);

  const handleFormatValueChange = useCallback((value: string) => {
    if (value === CREATE_FORMAT_SELECT_VALUE) {
      setIsCsvWizardOpen(true);
      return;
    }

    setSelectedStatementFormatId(Number(value));
    setSavedFormatMessage(null);
  }, []);

  const handleCsvWizardSaved = useCallback(
    (createdFormat: StatementFormat) => {
      setSavedStatementFormat(createdFormat);
      setSelectedStatementFormatId(createdFormat.id);
      setSavedFormatMessage(
        `${createdFormat.displayName} saved. Choose the statement file to preview transactions.`,
      );
      setIsCsvWizardOpen(false);
      setIsExpanded(true);
    },
    [setIsExpanded],
  );

  const handlePreviewModalOpenChange = useCallback((open: boolean) => {
    if (open) {
      setPreviewModal((prev) => ({ ...prev, isOpen: open }));
    } else {
      // Fully reset modal state when closing
      setPreviewModal({ isOpen: false, previewData: null });
    }
  }, []);

  const handlePreviewImportComplete = useCallback(
    (created: number, duplicatesSkipped: number, duplicatesImported: number) => {
      onSuccess?.(created, duplicatesSkipped, duplicatesImported);
    },
    [onSuccess],
  );

  const handleChooseFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAccountIdChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setAccountId(event.target.value);
  }, []);

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
  }, [setIsExpanded]);

  const handleCancel = useCallback(() => {
    setIsExpanded(false);
    setSelectedStatementFormatId(null);
    setSavedFormatMessage(null);
    setAccountId('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [setIsExpanded]);

  const handleDismissSavedFormatMessage = useCallback(() => {
    setSavedFormatMessage(null);
  }, []);

  const canSubmit = selectedFile && selectedStatementFormatId !== null;

  // All formats now use preview workflow
  const getButtonText = () => {
    if (isPending) return 'Loading...';
    return 'Preview Transactions';
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.pdf"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Transaction file input"
          />

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                variants={collapseFromRightVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={collapseTransition}
                className="flex items-center gap-2"
              >
                <div className="flex items-center">
                  <Select
                    value={
                      selectedStatementFormatId === null ? '' : String(selectedStatementFormatId)
                    }
                    onValueChange={handleFormatValueChange}
                  >
                    <SelectTrigger className="w-auto min-w-[180px]" disabled={isLoadingFormats}>
                      <SelectValue
                        placeholder={
                          isLoadingFormats
                            ? 'Loading...'
                            : isFormatsError
                              ? 'Error loading formats'
                              : enabledFormats.length === 0
                                ? 'No formats available'
                                : 'Select Format'
                        }
                      >
                        {selectedLabel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CREATE_FORMAT_SELECT_VALUE}>
                        Create new statement format
                      </SelectItem>
                      {enabledFormats.map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          {renderFormatSelectLabel(f)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 overflow-hidden">
                  <Input
                    type="text"
                    placeholder="Account ID (optional)"
                    value={accountId}
                    onChange={handleAccountIdChange}
                    className="w-[180px]"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    onClick={handleChooseFile}
                    className="max-w-[200px] whitespace-nowrap"
                  >
                    <span className="truncate">
                      {selectedFile ? selectedFile.name : 'Choose File'}
                    </span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleCancel}
                    aria-label="Cancel import"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!isExpanded ? (
            <Button onClick={handleExpand} size="default" variant="default">
              <Upload className="mr-2 h-4 w-4" />
              Import Transactions
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isPending || !canSubmit}
              size="default"
              variant="default"
            >
              <Upload className="mr-2 h-4 w-4" />
              {getButtonText()}
            </Button>
          )}
        </div>

        <AnimatePresence>
          {savedFormatMessage ? (
            <MessageBanner
              type="success"
              message={savedFormatMessage}
              onClose={handleDismissSavedFormatMessage}
            />
          ) : null}
        </AnimatePresence>
      </div>

      <TransactionPreviewModal
        isOpen={previewModal.isOpen}
        onOpenChange={handlePreviewModalOpenChange}
        previewData={previewModal.previewData}
        onImportComplete={handlePreviewImportComplete}
      />
      <CsvStatementFormatWizardDialog
        open={isCsvWizardOpen}
        onOpenChange={setIsCsvWizardOpen}
        initialAccountId={accountId || undefined}
        onSaved={handleCsvWizardSaved}
      />
    </>
  );
}
