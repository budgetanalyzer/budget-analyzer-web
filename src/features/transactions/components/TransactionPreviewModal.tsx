// src/features/transactions/components/TransactionPreviewModal.tsx
import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { PreviewTable } from '@/features/transactions/components/PreviewTable';
import { PreviewFileImportWarningBanner } from '@/features/transactions/components/PreviewFileImportWarningBanner';
import { useBatchImport } from '@/features/transactions/hooks/useBatchImport';
import {
  BatchImportTransactionRequest,
  PreviewResponse,
  PreviewTransaction,
} from '@/types/transaction';
import type {
  EditablePreviewTransaction,
  EditablePreviewTransactionField,
  EditablePreviewTransactionValue,
} from '@/features/transactions/types/preview';
import { toast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';
import { formatApiError } from '@/utils/errorMessages';

interface TransactionPreviewModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: PreviewResponse | null;
  onImportComplete: (
    created: number,
    duplicatesSkipped: number,
    duplicatesImported: number,
  ) => void;
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

function getSkippedDuplicateCount(transactions: EditablePreviewTransaction[]): number {
  return transactions.filter(
    (transaction) => transaction.duplicate && transaction.allowDuplicate !== true,
  ).length;
}

function getImportableTransactionCount(transactions: EditablePreviewTransaction[]): number {
  return transactions.length - getSkippedDuplicateCount(transactions);
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

export function TransactionPreviewModal({
  isOpen,
  onOpenChange,
  previewData,
  onImportComplete,
}: TransactionPreviewModalProps) {
  const [transactions, setTransactions] = useState<EditablePreviewTransaction[]>([]);
  const { mutate: batchImport, isPending: isImporting } = useBatchImport();

  // Sync state when modal opens with new data
  // This is needed because Dialog onOpenChange only fires on user interaction,
  // not when the controlled open prop changes programmatically
  useEffect(() => {
    if (isOpen && previewData) {
      setTransactions(previewData.transactions.map(toEditableTransaction));
    }
  }, [isOpen, previewData]);

  // Handle user-initiated open/close
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open && previewData) {
        setTransactions(previewData.transactions.map(toEditableTransaction));
      }
      if (!isImporting) {
        onOpenChange(open);
      }
    },
    [previewData, isImporting, onOpenChange],
  );

  const handleUpdateTransaction = useCallback(
    (
      index: number,
      field: EditablePreviewTransactionField,
      value: EditablePreviewTransactionValue,
    ) => {
      setTransactions((prev) => {
        return prev.map((transaction, transactionIndex) => {
          if (transactionIndex !== index) {
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
        });
      });
    },
    [],
  );

  const handleRemoveTransaction = useCallback((index: number) => {
    setTransactions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleImport = useCallback(() => {
    if (getImportableTransactionCount(transactions) === 0 || !previewData) {
      return;
    }

    batchImport(
      {
        previewImportToken: previewData.previewImportToken,
        transactions: transactions.map(toBatchImportTransaction),
      },
      {
        onSuccess: (data) => {
          onOpenChange(false);
          onImportComplete(data.created, data.duplicatesSkipped, data.duplicatesImported);
        },
        onError: (error) => {
          toast.error(formatApiError(error, 'Failed to import transactions'));
        },
      },
    );
  }, [transactions, previewData, batchImport, onOpenChange, onImportComplete]);

  const handleCancel = useCallback(() => {
    if (!isImporting) {
      onOpenChange(false);
    }
  }, [isImporting, onOpenChange]);

  const skippedDuplicateCount = getSkippedDuplicateCount(transactions);
  const importableTransactionCount = getImportableTransactionCount(transactions);
  const importButtonLabel = buildImportButtonLabel(transactions.length, skippedDuplicateCount);
  const hasDuplicateRows = transactions.some((transaction) => transaction.duplicate);

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
          <DialogDescription>
            {previewData && (
              <>
                File: {previewData.sourceFile} | {transactions.length} transaction
                {transactions.length !== 1 ? 's' : ''}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {previewData && <PreviewFileImportWarningBanner fileImport={previewData.fileImport} />}
          <div className="flex-1 overflow-y-auto">
            <PreviewTable
              transactions={transactions}
              onUpdateTransaction={handleUpdateTransaction}
              onRemoveTransaction={handleRemoveTransaction}
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={handleCancel} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isImporting || importableTransactionCount === 0}>
            {isImporting ? 'Importing...' : importButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
