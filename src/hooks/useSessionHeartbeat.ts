import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { getSessionStatus } from '@/api/auth';
import { useActivityTracking } from '@/hooks/useActivityTracking';

const LOGOUT_PATH = '/logout';
const CONNECTION_WARNING = 'Unable to reach the server. Your session may expire.';

const DEFAULT_HEARTBEAT_INTERVAL_MS =
  Number(import.meta.env.VITE_HEARTBEAT_INTERVAL_MS) || 2 * 60 * 1000;
const DEFAULT_WARNING_BEFORE_EXPIRY_S =
  Number(import.meta.env.VITE_WARNING_BEFORE_EXPIRY_SECONDS) || 2 * 60;

interface UseSessionHeartbeatOptions {
  enabled: boolean;
  heartbeatIntervalMs?: number;
  warningBeforeExpirySec?: number;
}

function isStatus401(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

function isTransientError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 502;
}

export function useSessionHeartbeat({
  enabled,
  heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
  warningBeforeExpirySec = DEFAULT_WARNING_BEFORE_EXPIRY_S,
}: UseSessionHeartbeatOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [connectionWarning, setConnectionWarning] = useState<string | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const channelRef = useRef<BroadcastChannel>(undefined);
  const { wasActiveSinceLastCheck } = useActivityTracking();

  const dismissConnectionWarning = useCallback(() => {
    setConnectionWarning(null);
  }, []);

  const scheduleWarning = useCallback(
    (serverExpiresAt: number) => {
      clearTimeout(warningTimerRef.current);
      setExpiresAt(serverExpiresAt);
      const expiresInSeconds = serverExpiresAt - Math.floor(Date.now() / 1000);
      const delaySec = Math.max(0, expiresInSeconds - warningBeforeExpirySec);

      if (delaySec === 0) {
        setShowWarning(true);
      } else {
        warningTimerRef.current = setTimeout(() => {
          setShowWarning(true);
        }, delaySec * 1000);
      }
    },
    [warningBeforeExpirySec],
  );

  const performHeartbeat = useCallback(async () => {
    setIsSending(true);
    try {
      const status = await getSessionStatus();
      setConnectionWarning(null);
      setShowWarning(false);
      scheduleWarning(status.expiresAt);
      channelRef.current?.postMessage({ expiresAt: status.expiresAt });
    } catch (error) {
      if (isStatus401(error)) {
        window.location.href = LOGOUT_PATH;
        return;
      }
      if (isNetworkError(error) || isTransientError(error)) {
        try {
          const status = await getSessionStatus();
          setConnectionWarning(null);
          setShowWarning(false);
          scheduleWarning(status.expiresAt);
          channelRef.current?.postMessage({ expiresAt: status.expiresAt });
        } catch (retryError) {
          if (isStatus401(retryError)) {
            window.location.href = LOGOUT_PATH;
            return;
          }
          if (isNetworkError(retryError) || isTransientError(retryError)) {
            setConnectionWarning(CONNECTION_WARNING);
          }
        }
      }
    } finally {
      setIsSending(false);
    }
  }, [scheduleWarning]);

  useEffect(() => {
    if (!enabled) return;

    const channel = new BroadcastChannel('session-heartbeat');
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<{ expiresAt: number }>) => {
      setConnectionWarning(null);
      setShowWarning(false);
      scheduleWarning(event.data.expiresAt);
    };

    performHeartbeat();

    intervalRef.current = setInterval(() => {
      if (wasActiveSinceLastCheck()) {
        performHeartbeat();
      }
    }, heartbeatIntervalMs);

    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(warningTimerRef.current);
      channel.close();
    };
  }, [enabled, heartbeatIntervalMs, performHeartbeat, scheduleWarning, wasActiveSinceLastCheck]);

  return {
    showWarning,
    isSending,
    sendHeartbeat: performHeartbeat,
    expiresAt,
    connectionWarning,
    dismissConnectionWarning,
  };
}
