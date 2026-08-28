// src/features/transactions/components/TransactionPreviewModal.tsx
import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { MessageBanner } from '@/components/MessageBanner';
import { Button } from '@/components/ui/Button';
import { PreviewTable } from '@/features/transactions/components/PreviewTable';
import { PreviewFileImportWarningBanner } from '@/features/transactions/components/PreviewFileImportWarningBanner';
import { useBatchImport } from '@/features/transactions/hooks/useBatchImport';
import {
  BatchImportTransactionRequest,
  PreviewFileImportStatusResponse,
  PreviewResponse,
  PreviewTransaction,
} from '@/types/transaction';
import type { StatementFormat } from '@/types/statementFormat';
import type {
  EditablePreviewTableRow,
  EditablePreviewTransaction,
  EditablePreviewTransactionField,
  EditablePreviewTransactionValue,
} from '@/features/transactions/types/preview';
import { cn } from '@/utils/cn';
import { formatApiError } from '@/utils/errorMessages';

interface TransactionPreviewModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: PreviewResponse;
  statementFormats?: StatementFormat[];
  onImportComplete: (
    created: number,
    duplicatesSkipped: number,
    duplicatesImported: number,
  ) => void;
}

interface EditablePreviewFile {
  fileIndex: number;
  sourceFile: string;
  statementFormatId: number;
  previewImportToken: string;
  fileImport: PreviewFileImportStatusResponse;
  transactions: EditablePreviewTransaction[];
}

interface AggregateReviewData {
  rows: EditablePreviewTableRow[];
  totalVisibleRows: number;
  skippedDuplicateCount: number;
  allowedDuplicateCount: number;
  importableTransactionCount: number;
}

const duplicateKeyFields = new Set<EditablePreviewTransactionField>([
  'date',
  'description',
  'amount',
  'type',
  'bankName',
  'currencyIsoCode',
  'accountId',
]);

function toEditableTransaction(transaction: PreviewTransaction): EditablePreviewTransaction {
  return {
    ...transaction,
    allowDuplicate: false,
  };
}

function toEditableFiles(previewData: PreviewResponse): EditablePreviewFile[] {
  return previewData.files.map((file, fileIndex) => ({
    fileIndex,
    sourceFile: file.sourceFile,
    statementFormatId: file.statementFormatId,
    previewImportToken: file.previewImportToken,
    fileImport: file.fileImport,
    transactions: file.transactions.map(toEditableTransaction),
  }));
}

function toBatchImportTransaction(
  transaction: EditablePreviewTransaction,
): BatchImportTransactionRequest {
  const {
    date,
    description,
    amount,
    type,
    category,
    bankName,
    currencyIsoCode,
    accountId,
    duplicate,
    allowDuplicate,
  } = transaction;

  return {
    date,
    description,
    amount,
    type,
    category,
    bankName,
    currencyIsoCode,
    accountId,
    ...(duplicate && allowDuplicate === true ? { allowDuplicate: true } : {}),
  };
}

function getTransactionLabel(count: number): string {
  return count === 1 ? 'Transaction' : 'Transactions';
}

function getDuplicateLabel(count: number): string {
  return count === 1 ? 'Duplicate' : 'Duplicates';
}

function buildImportButtonLabel(transactionCount: number, skippedDuplicateCount: number): string {
  if (skippedDuplicateCount === 0) {
    return `Import ${transactionCount} ${getTransactionLabel(transactionCount)}`;
  }

  const importCount = transactionCount - skippedDuplicateCount;
  return `Import ${importCount} ${getTransactionLabel(importCount)}, Skip ${skippedDuplicateCount} ${getDuplicateLabel(skippedDuplicateCount)}`;
}

function buildReviewSummary(files: EditablePreviewFile[], transactionCount: number): string {
  const transactionSummary = `${transactionCount} transaction${transactionCount === 1 ? '' : 's'}`;

  if (files.length === 1) {
    return `File: ${files[0].sourceFile} | ${transactionSummary}`;
  }

  return `${files.length} files | ${transactionSummary}`;
}

export function TransactionPreviewModal({
  isOpen,
  onOpenChange,
  previewData,
  statementFormats,
  onImportComplete,
}: TransactionPreviewModalProps) {
  const [editableFiles, setEditableFiles] = useState<EditablePreviewFile[]>(() =>
    toEditableFiles(previewData),
  );
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const { mutate: batchImport, isPending: isImporting } = useBatchImport();

  const reviewData = useMemo<AggregateReviewData>(() => {
    const rows = editableFiles.flatMap((file) =>
      file.transactions.map((transaction, transactionIndex) => ({
        fileIndex: file.fileIndex,
        transactionIndex,
        transaction,
      })),
    );
    const duplicateRows = rows.filter(({ transaction }) => transaction.duplicate);
    const allowedDuplicateCount = duplicateRows.filter(
      ({ transaction }) => transaction.allowDuplicate === true,
    ).length;
    const skippedDuplicateCount = duplicateRows.length - allowedDuplicateCount;

    return {
      rows,
      totalVisibleRows: rows.length,
      skippedDuplicateCount,
      allowedDuplicateCount,
      importableTransactionCount: rows.length - duplicateRows.length + allowedDuplicateCount,
    };
  }, [editableFiles]);

  // Handle user-initiated open/close
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!isImporting) {
        if (!open) {
          setImportErrorMessage(null);
        }
        onOpenChange(open);
      }
    },
    [isImporting, onOpenChange],
  );

  const handleUpdateTransaction = useCallback(
    (
      fileIndex: number,
      transactionIndex: number,
      field: EditablePreviewTransactionField,
      value: EditablePreviewTransactionValue,
    ) => {
      setEditableFiles((previousFiles) =>
        previousFiles.map((file) => {
          if (file.fileIndex !== fileIndex) {
            return file;
          }

          return {
            ...file,
            transactions: file.transactions.map((transaction, currentTransactionIndex) => {
              if (currentTransactionIndex !== transactionIndex) {
                return transaction;
              }

              const updated = {
                ...transaction,
                [field]: value,
              } as EditablePreviewTransaction;

              if (duplicateKeyFields.has(field) && transaction.duplicate) {
                updated.duplicate = false;
                updated.duplicateReason = null;
                updated.allowDuplicate = false;
              }

              return updated;
            }),
          };
        }),
      );
    },
    [],
  );

  const handleRemoveTransaction = useCallback((fileIndex: number, transactionIndex: number) => {
    setEditableFiles((previousFiles) =>
      previousFiles.map((file) => {
        if (file.fileIndex !== fileIndex) {
          return file;
        }

        return {
          ...file,
          transactions: file.transactions.filter(
            (_, currentTransactionIndex) => currentTransactionIndex !== transactionIndex,
          ),
        };
      }),
    );
  }, []);

  const handleImport = useCallback(() => {
    if (reviewData.importableTransactionCount === 0) {
      return;
    }

    setImportErrorMessage(null);
    batchImport(
      {
        files: editableFiles.map((file) => ({
          previewImportToken: file.previewImportToken,
          transactions: file.transactions.map(toBatchImportTransaction),
        })),
      },
      {
        onSuccess: (data) => {
          setImportErrorMessage(null);
          onOpenChange(false);
          onImportComplete(data.created, data.duplicatesSkipped, data.duplicatesImported);
        },
        onError: (error) => {
          setImportErrorMessage(formatApiError(error, 'Failed to import transactions'));
        },
      },
    );
  }, [
    reviewData.importableTransactionCount,
    editableFiles,
    batchImport,
    onOpenChange,
    onImportComplete,
  ]);

  const handleCancel = useCallback(() => {
    if (!isImporting) {
      setImportErrorMessage(null);
      onOpenChange(false);
    }
  }, [isImporting, onOpenChange]);

  const handleDismissImportError = useCallback(() => {
    setImportErrorMessage(null);
  }, []);

  const importButtonLabel = buildImportButtonLabel(
    reviewData.totalVisibleRows,
    reviewData.skippedDuplicateCount,
  );
  const hasDuplicateRows = reviewData.skippedDuplicateCount + reviewData.allowedDuplicateCount > 0;
  const reviewSummary = buildReviewSummary(editableFiles, reviewData.totalVisibleRows);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[85vh] max-w-[calc(100vw-2rem)] overflow-hidden flex flex-col',
          hasDuplicateRows ? 'xl:max-w-7xl' : 'xl:max-w-5xl',
        )}
      >
        <DialogHeader>
          <DialogTitle>Preview Import</DialogTitle>
          <DialogDescription>{reviewSummary}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pt-4">
          <div className="space-y-4">
            <div className="space-y-3">
              {editableFiles.map((file) =>
                file.fileImport.alreadyImported ? (
                  <PreviewFileImportWarningBanner
                    key={file.fileIndex}
                    sourceFile={file.sourceFile}
                    fileImport={file.fileImport}
                    statementFormats={statementFormats}
                  />
                ) : null,
              )}
            </div>
            <PreviewTable
              rows={reviewData.rows}
              onUpdateTransaction={handleUpdateTransaction}
              onRemoveTransaction={handleRemoveTransaction}
            />
          </div>
        </div>

        {importErrorMessage ? (
          <MessageBanner
            type="error"
            message={importErrorMessage}
            onClose={handleDismissImportError}
          />
        ) : null}

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={handleCancel} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || reviewData.importableTransactionCount === 0}
          >
            {isImporting ? 'Importing...' : importButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
