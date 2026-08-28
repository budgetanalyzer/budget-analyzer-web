import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSessionHeartbeat } from '@/hooks/useSessionHeartbeat';
import { InactivityWarningModal } from '@/components/InactivityWarningModal';
import { MessageBanner } from '@/components/MessageBanner';

export function SessionHeartbeatProvider() {
  const { isAuthenticated } = useAuth();
  const {
    showWarning,
    isSending,
    sendHeartbeat,
    expiresAt,
    connectionWarning,
    dismissConnectionWarning,
  } = useSessionHeartbeat({ enabled: isAuthenticated });

  return (
    <>
      {isAuthenticated && connectionWarning && (
        <MessageBanner
          type="warning"
          message={connectionWarning}
          onClose={dismissConnectionWarning}
        />
      )}
      <InactivityWarningModal
        open={isAuthenticated && showWarning}
        isSending={isSending}
        onContinue={sendHeartbeat}
        expiresAt={expiresAt}
      />
    </>
  );
}
