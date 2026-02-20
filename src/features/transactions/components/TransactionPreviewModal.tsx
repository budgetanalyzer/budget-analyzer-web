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
import { PreviewWarningBanner } from '@/features/transactions/components/PreviewWarningBanner';
import { PreviewTable } from '@/features/transactions/components/PreviewTable';
import { useBatchImport } from '@/features/transactions/hooks/useBatchImport';
import { PreviewTransaction, PreviewWarning, PreviewResponse } from '@/types/transaction';
import { toast } from 'sonner';
import { formatApiError } from '@/utils/errorMessages';

interface TransactionPreviewModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  previewData: PreviewResponse | null;
  onImportComplete: (created: number, duplicatesSkipped: number) => void;
}

export function TransactionPreviewModal({
  isOpen,
  onOpenChange,
  previewData,
  onImportComplete,
}: TransactionPreviewModalProps) {
  const [transactions, setTransactions] = useState<PreviewTransaction[]>([]);
  const [warnings, setWarnings] = useState<PreviewWarning[]>([]);
  const { mutate: batchImport, isPending: isImporting } = useBatchImport();

  // Sync state when modal opens with new data
  // This is needed because Dialog onOpenChange only fires on user interaction,
  // not when the controlled open prop changes programmatically
  useEffect(() => {
    if (isOpen && previewData) {
      setTransactions([...previewData.transactions]);
      setWarnings([...previewData.warnings]);
    }
  }, [isOpen, previewData]);

  // Handle user-initiated open/close
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open && previewData) {
        setTransactions([...previewData.transactions]);
        setWarnings([...previewData.warnings]);
      }
      if (!isImporting) {
        onOpenChange(open);
      }
    },
    [previewData, isImporting, onOpenChange],
  );

  const handleUpdateTransaction = useCallback(
    (index: number, field: keyof PreviewTransaction, value: string | number) => {
      setTransactions((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
      // Clear warning for this field if it exists
      setWarnings((prev) => prev.filter((w) => !(w.index === index && w.field === field)));
    },
    [],
  );

  const handleRemoveTransaction = useCallback((index: number) => {
    setTransactions((prev) => prev.filter((_, i) => i !== index));
    // Update warning indices for rows after the removed one
    setWarnings((prev) =>
      prev
        .filter((w) => w.index !== index)
        .map((w) => (w.index > index ? { ...w, index: w.index - 1 } : w)),
    );
  }, []);

  const handleImport = useCallback(() => {
    if (transactions.length === 0) {
      return;
    }

    batchImport(transactions, {
      onSuccess: (data) => {
        onOpenChange(false);
        onImportComplete(data.created, data.duplicatesSkipped);
      },
      onError: (error) => {
        toast.error(formatApiError(error, 'Failed to import transactions'));
      },
    });
  }, [transactions, batchImport, onOpenChange, onImportComplete]);

  const handleCancel = useCallback(() => {
    if (!isImporting) {
      onOpenChange(false);
    }
  }, [isImporting, onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
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
          {warnings.length > 0 && <PreviewWarningBanner warnings={warnings} />}

          <div className="flex-1 overflow-y-auto">
            <PreviewTable
              transactions={transactions}
              warnings={warnings}
              onUpdateTransaction={handleUpdateTransaction}
              onRemoveTransaction={handleRemoveTransaction}
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={handleCancel} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isImporting || transactions.length === 0}>
            {isImporting
              ? 'Importing...'
              : `Import ${transactions.length} Transaction${transactions.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
