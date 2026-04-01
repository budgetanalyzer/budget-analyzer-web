import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSessionHeartbeat } from '@/hooks/useSessionHeartbeat';
import { InactivityWarningModal } from '@/components/InactivityWarningModal';

export function SessionHeartbeatProvider() {
  const { isAuthenticated } = useAuth();
  const { showWarning, isSending, sendHeartbeat, expiresAt } = useSessionHeartbeat({
    enabled: isAuthenticated,
  });

  return (
    <InactivityWarningModal
      open={showWarning}
      isSending={isSending}
      onContinue={sendHeartbeat}
      expiresAt={expiresAt}
    />
  );
}
