import { useCallback, useEffect, useRef } from 'react';
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
import { submitLogoutForm } from '@/utils/logout';

interface InactivityWarningModalProps {
  open: boolean;
  isSending: boolean;
  onContinue: () => void;
  expiresAt: number | null;
  canExtend: boolean;
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
  canExtend,
}: InactivityWarningModalProps) {
  const secondsLeft = useCountdown(expiresAt, open);
  const countdownReady = useRef(false);

  useEffect(() => {
    if (open && secondsLeft > 0) countdownReady.current = true;
    if (!open) countdownReady.current = false;
  }, [open, secondsLeft]);

  useEffect(() => {
    if (open && countdownReady.current && secondsLeft === 0 && expiresAt != null && !isSending) {
      submitLogoutForm();
    }
  }, [open, secondsLeft, expiresAt, isSending]);

  const handleSignOut = useCallback(() => {
    submitLogoutForm();
  }, []);

  let description: string;
  if (!canExtend && expiresAt != null) {
    description = `Your session has reached its maximum length and will end in ${formatCountdown(secondsLeft)}. Sign in again to keep working.`;
  } else if (expiresAt != null) {
    description = `Your session will expire in ${formatCountdown(secondsLeft)} due to inactivity. Click Continue to stay signed in.`;
  } else {
    description =
      'Your session will expire soon due to inactivity. Click Continue to stay signed in.';
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent dismissible={false}>
        <DialogHeader>
          <DialogTitle>Session Expiring</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {canExtend ? (
            <Button onClick={onContinue} disabled={isSending}>
              Continue
            </Button>
          ) : (
            <Button onClick={handleSignOut}>Sign out now</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
