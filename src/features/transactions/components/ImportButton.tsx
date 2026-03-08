// src/features/transactions/components/ImportButton.tsx
import { useRef, useState, useCallback, useMemo } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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

interface ImportButtonProps {
  onSuccess?: (count: number) => void;
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

  const setIsExpanded = useCallback(
    (expanded: boolean) => {
      setIsExpandedState(expanded);
      onExpandedChange?.(expanded);
    },
    [onExpandedChange],
  );
  const [format, setFormat] = useState<string>('');
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

  // Filter to only enabled formats with enabled currencies
  const enabledFormats = useMemo(() => {
    if (!Array.isArray(statementFormats)) return [];
    return statementFormats.filter(
      (f) => f.enabled && enabledCurrencyCodes.has(f.defaultCurrencyIsoCode),
    );
  }, [statementFormats, enabledCurrencyCodes]);

  // Get display label for selected format
  const selectedFormat = enabledFormats.find((f) => f.formatKey === format);
  const selectedLabel = selectedFormat?.displayName ?? null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const clearForm = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSelectedFile(null);
    setFormat('');
    setAccountId('');
    setIsExpanded(false);
  }, [setIsExpanded]);

  const handleSubmit = useCallback(() => {
    if (!selectedFile || !format) {
      return;
    }

    // All formats now use the preview workflow
    previewTransactions(
      {
        file: selectedFile,
        format,
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
  }, [selectedFile, format, accountId, previewTransactions, clearForm, onError]);

  const handlePreviewModalOpenChange = useCallback((open: boolean) => {
    if (open) {
      setPreviewModal((prev) => ({ ...prev, isOpen: open }));
    } else {
      // Fully reset modal state when closing
      setPreviewModal({ isOpen: false, previewData: null });
    }
  }, []);

  const handlePreviewImportComplete = useCallback(
    (created: number) => {
      onSuccess?.(created);
    },
    [onSuccess],
  );

  const handleChooseFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleCancel = useCallback(() => {
    setIsExpanded(false);
    setFormat('');
    setAccountId('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [setIsExpanded]);

  const canSubmit = selectedFile && format;

  // All formats now use preview workflow
  const getButtonText = () => {
    if (isPending) return 'Loading...';
    return 'Preview Transactions';
  };

  return (
    <>
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
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger
                    className="w-auto min-w-[180px]"
                    disabled={isLoadingFormats || isFormatsError || enabledFormats.length === 0}
                  >
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
                    {enabledFormats.map((f) => (
                      <SelectItem key={f.formatKey} value={f.formatKey}>
                        {f.displayName}
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
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-[180px]"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={handleChooseFile}
                  className="whitespace-nowrap max-w-[200px]"
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
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isExpanded ? (
          <Button onClick={() => setIsExpanded(true)} size="default" variant="default">
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

      <TransactionPreviewModal
        isOpen={previewModal.isOpen}
        onOpenChange={handlePreviewModalOpenChange}
        previewData={previewModal.previewData}
        onImportComplete={handlePreviewImportComplete}
      />
    </>
  );
}
