import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

interface InactivityWarningModalProps {
  open: boolean;
  isSending: boolean;
  onContinue: () => void;
}

export function InactivityWarningModal({
  open,
  isSending,
  onContinue,
}: InactivityWarningModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showClose={false}>
        <DialogHeader>
          <DialogTitle>Session Expiring</DialogTitle>
          <DialogDescription>
            Your session will expire soon due to inactivity. Click Continue to stay signed in.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onContinue} disabled={isSending}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
