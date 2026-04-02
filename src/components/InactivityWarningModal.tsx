import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { useCountdown } from '@/hooks/useCountdown';

interface InactivityWarningModalProps {
  open: boolean;
  isSending: boolean;
  onContinue: () => void;
  expiresAt: number | null;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function InactivityWarningModal({
  open,
  isSending,
  onContinue,
  expiresAt,
}: InactivityWarningModalProps) {
  const secondsLeft = useCountdown(expiresAt, open);
  const countdownReady = useRef(false);

  useEffect(() => {
    if (open && secondsLeft > 0) countdownReady.current = true;
    if (!open) countdownReady.current = false;
  }, [open, secondsLeft]);

  useEffect(() => {
    if (open && countdownReady.current && secondsLeft === 0 && expiresAt != null && !isSending) {
      window.location.href = '/logout';
    }
  }, [open, secondsLeft, expiresAt, isSending]);

  const description =
    expiresAt != null
      ? `Your session will expire in ${formatCountdown(secondsLeft)} due to inactivity. Click Continue to stay signed in.`
      : 'Your session will expire soon due to inactivity. Click Continue to stay signed in.';

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showClose={false}>
        <DialogHeader>
          <DialogTitle>Session Expiring</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
