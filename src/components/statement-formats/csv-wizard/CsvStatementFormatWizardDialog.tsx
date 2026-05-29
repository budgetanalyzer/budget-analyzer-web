import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import type { StatementFormat } from '@/types/statementFormat';

interface CsvStatementFormatWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAccountId?: string;
  onSaved: (format: StatementFormat) => void;
}

export function CsvStatementFormatWizardDialog({
  open,
  onOpenChange,
}: CsvStatementFormatWizardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create statement format</DialogTitle>
          <DialogDescription>
            Upload a CSV sample to start mapping a custom format.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
