import { useCallback, useState } from 'react';
import { CsvStatementFormatWizardDialog } from '@/components/statement-formats/csv-wizard/CsvStatementFormatWizardDialog';
import { PdfStatementFormatWizardDialog } from '@/components/statement-formats/pdf-wizard/PdfStatementFormatWizardDialog';
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
import type { StatementFormat } from '@/types/statementFormat';

type WizardBranch = 'upload' | 'csv' | 'pdf';

interface StatementFormatWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAccountId?: string;
  onSaved: (format: StatementFormat) => void;
}

function detectWizardBranch(file: File): Exclude<WizardBranch, 'upload'> | null {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  if (fileName.endsWith('.csv') || mimeType === 'text/csv') {
    return 'csv';
  }

  if (fileName.endsWith('.pdf') || mimeType === 'application/pdf') {
    return 'pdf';
  }

  return null;
}

export function StatementFormatWizardDialog({
  open,
  onOpenChange,
  initialAccountId,
  onSaved,
}: StatementFormatWizardDialogProps) {
  const [branch, setBranch] = useState<WizardBranch>('upload');
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setBranch('upload');
    setSampleFile(null);
    setFileError(null);
  }, []);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetState();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetState],
  );

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.currentTarget.files?.[0] ?? null;

    setSampleFile(nextFile);
    setFileError(null);

    if (!nextFile) return;

    const nextBranch = detectWizardBranch(nextFile);

    if (!nextBranch) {
      setFileError('Choose a CSV or PDF sample file.');
      return;
    }

    setBranch(nextBranch);
  }, []);

  const handleCancel = useCallback(() => {
    handleDialogOpenChange(false);
  }, [handleDialogOpenChange]);

  const handleSaved = useCallback(
    (format: StatementFormat) => {
      resetState();
      onSaved(format);
      onOpenChange(false);
    },
    [onOpenChange, onSaved, resetState],
  );

  if (branch === 'csv') {
    return (
      <CsvStatementFormatWizardDialog
        open={open}
        onOpenChange={handleDialogOpenChange}
        initialFile={sampleFile ?? undefined}
        initialAccountId={initialAccountId}
        onSaved={handleSaved}
      />
    );
  }

  if (branch === 'pdf') {
    return (
      <PdfStatementFormatWizardDialog
        open={open}
        onOpenChange={handleDialogOpenChange}
        initialFile={sampleFile ?? undefined}
        initialAccountId={initialAccountId}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create statement format</DialogTitle>
          <DialogDescription>
            Upload a CSV or text-based PDF sample to start the matching setup flow.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="statement-format-wizard-file" className="text-sm font-medium">
              Sample file
            </label>
            <Input
              id="statement-format-wizard-file"
              type="file"
              accept=".csv,text/csv,.pdf,application/pdf"
              onChange={handleFileChange}
            />
          </div>

          {sampleFile ? (
            <p className="text-sm text-muted-foreground">Selected file: {sampleFile.name}</p>
          ) : null}
          {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
        </div>

        <DialogFooter className="mt-6 gap-2">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
