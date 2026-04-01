import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionHeartbeat } from '@/hooks/useSessionHeartbeat';
import * as authApi from '@/api/auth';
import * as activityTracking from '@/hooks/useActivityTracking';
import * as toastModule from '@/hooks/useToast';
import type { SessionStatus } from '@/types/session';
import { AxiosError, AxiosHeaders } from 'axios';

vi.mock('@/api/auth');
vi.mock('@/hooks/useActivityTracking');

// jsdom does not provide BroadcastChannel
class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  closed = false;

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown) {
    for (const instance of MockBroadcastChannel.instances) {
      if (instance !== this && instance.name === this.name && !instance.closed) {
        instance.onmessage?.(new MessageEvent('message', { data }));
      }
    }
  }

  close() {
    this.closed = true;
    MockBroadcastChannel.instances = MockBroadcastChannel.instances.filter((i) => i !== this);
  }
}

vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

const DEFAULT_HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000;
const mockGetSessionStatus = vi.mocked(authApi.getSessionStatus);
const mockWasActive = vi.fn<() => boolean>();

function makeSessionStatus(overrides?: Partial<SessionStatus>): SessionStatus {
  return {
    authenticated: true,
    userId: 'user-1',
    roles: ['ADMIN'],
    expiresAt: Math.floor(Date.now() / 1000) + 1800,
    tokenRefreshed: false,
    ...overrides,
  };
}

function make401Error(): AxiosError {
  const error = new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 401,
    statusText: 'Unauthorized',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
  return error;
}

function makeNetworkError(): AxiosError {
  return new AxiosError('Network Error', 'ERR_NETWORK');
}

function make502Error(): AxiosError {
  return new AxiosError('Bad Gateway', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status: 502,
    statusText: 'Bad Gateway',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

async function advanceTimers(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useSessionHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(activityTracking.useActivityTracking).mockReturnValue({
      wasActiveSinceLastCheck: mockWasActive,
    });
    mockGetSessionStatus.mockResolvedValue(makeSessionStatus());
    mockWasActive.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    MockBroadcastChannel.instances = [];
  });

  it('does nothing when enabled is false', async () => {
    renderHook(() => useSessionHeartbeat({ enabled: false }));
    await advanceTimers(0);
    expect(mockGetSessionStatus).not.toHaveBeenCalled();
  });

  it('fires initial heartbeat on mount when enabled', async () => {
    renderHook(() => useSessionHeartbeat({ enabled: true }));
    await advanceTimers(0);
    expect(mockGetSessionStatus).toHaveBeenCalledTimes(1);
  });

  it('fires heartbeat on interval when user is active', async () => {
    renderHook(() => useSessionHeartbeat({ enabled: true, heartbeatIntervalMs: 1000 }));
    await advanceTimers(0); // initial
    expect(mockGetSessionStatus).toHaveBeenCalledTimes(1);

    await advanceTimers(1000); // first interval
    expect(mockGetSessionStatus).toHaveBeenCalledTimes(2);
  });

  it('skips heartbeat on interval when user is inactive', async () => {
    mockWasActive.mockReturnValue(false);
    renderHook(() => useSessionHeartbeat({ enabled: true, heartbeatIntervalMs: 1000 }));
    await advanceTimers(0); // initial (always fires)
    expect(mockGetSessionStatus).toHaveBeenCalledTimes(1);

    await advanceTimers(1000);
    expect(mockGetSessionStatus).toHaveBeenCalledTimes(1); // no additional call
  });

  it('sets warning timer based on expiresAt from response', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetSessionStatus.mockResolvedValue(
      makeSessionStatus({ expiresAt: now + 600 }), // 10 min left
    );

    const { result } = renderHook(() =>
      useSessionHeartbeat({
        enabled: true,
        warningBeforeExpirySec: 300, // warn 5 min before
      }),
    );
    await advanceTimers(0);
    expect(result.current.showWarning).toBe(false);

    // Advance to warning time (600 - 300 = 300s)
    await advanceTimers(300 * 1000);
    expect(result.current.showWarning).toBe(true);
  });

  it('shows warning immediately when remaining time <= warning threshold', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetSessionStatus.mockResolvedValue(
      makeSessionStatus({ expiresAt: now + 60 }), // 1 min left
    );

    const { result } = renderHook(() =>
      useSessionHeartbeat({
        enabled: true,
        warningBeforeExpirySec: 300,
      }),
    );
    await advanceTimers(0);
    expect(result.current.showWarning).toBe(true);
  });

  it('redirects to logout on 401 response', async () => {
    mockGetSessionStatus.mockRejectedValue(make401Error());
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window.location, 'href', {
      set: hrefSetter,
      get: () => '',
      configurable: true,
    });

    renderHook(() => useSessionHeartbeat({ enabled: true }));
    await advanceTimers(0);
    expect(hrefSetter).toHaveBeenCalledWith('/logout');
  });

  it('retries once on network error then shows toast warning', async () => {
    const toastSpy = vi.spyOn(toastModule.toast, 'warning');
    mockGetSessionStatus
      .mockRejectedValueOnce(makeNetworkError())
      .mockRejectedValueOnce(makeNetworkError());

    renderHook(() => useSessionHeartbeat({ enabled: true }));
    await advanceTimers(0);

    expect(mockGetSessionStatus).toHaveBeenCalledTimes(2); // initial + retry
    expect(toastSpy).toHaveBeenCalledWith('Unable to reach the server. Your session may expire.');
  });

  it('sendHeartbeat hides warning on success', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetSessionStatus.mockResolvedValue(makeSessionStatus({ expiresAt: now + 60 }));

    const { result } = renderHook(() =>
      useSessionHeartbeat({
        enabled: true,
        warningBeforeExpirySec: 300,
      }),
    );
    await advanceTimers(0);
    expect(result.current.showWarning).toBe(true);

    // Now heartbeat returns healthy session
    mockGetSessionStatus.mockResolvedValue(makeSessionStatus({ expiresAt: now + 1800 }));
    await act(async () => {
      await result.current.sendHeartbeat();
    });
    expect(result.current.showWarning).toBe(false);
  });

  it('cleans up timers on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { unmount } = renderHook(() =>
      useSessionHeartbeat({ enabled: true, heartbeatIntervalMs: 1000 }),
    );
    await advanceTimers(0);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('retries once on 502 transient error then shows toast warning', async () => {
    const toastSpy = vi.spyOn(toastModule.toast, 'warning');
    mockGetSessionStatus
      .mockRejectedValueOnce(make502Error())
      .mockRejectedValueOnce(make502Error());

    renderHook(() => useSessionHeartbeat({ enabled: true }));
    await advanceTimers(0);

    expect(mockGetSessionStatus).toHaveBeenCalledTimes(2);
    expect(toastSpy).toHaveBeenCalledWith('Unable to reach the server. Your session may expire.');
  });

  it('retries once on 502 and succeeds on retry', async () => {
    const toastSpy = vi.spyOn(toastModule.toast, 'warning');
    mockGetSessionStatus
      .mockRejectedValueOnce(make502Error())
      .mockResolvedValueOnce(makeSessionStatus());

    const { result } = renderHook(() => useSessionHeartbeat({ enabled: true }));
    await advanceTimers(0);

    expect(mockGetSessionStatus).toHaveBeenCalledTimes(2);
    expect(toastSpy).not.toHaveBeenCalled();
    expect(result.current.showWarning).toBe(false);
  });

  it('broadcasts expiresAt to other tabs on successful heartbeat', async () => {
    const sessionStatus = makeSessionStatus();
    mockGetSessionStatus.mockResolvedValue(sessionStatus);

    renderHook(() => useSessionHeartbeat({ enabled: true }));
    await advanceTimers(0);

    // A second channel on the same name should have received the broadcast
    const receiver = new MockBroadcastChannel('session-heartbeat');
    let received: { expiresAt: number } | null = null;
    receiver.onmessage = (event: MessageEvent) => {
      received = event.data;
    };

    // Trigger another heartbeat
    mockWasActive.mockReturnValue(true);
    await advanceTimers(DEFAULT_HEARTBEAT_INTERVAL_MS);

    expect(received).toEqual({ expiresAt: sessionStatus.expiresAt });
    receiver.close();
  });

  it('receiving broadcast from another tab reschedules warning and hides modal', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetSessionStatus.mockResolvedValue(makeSessionStatus({ expiresAt: now + 60 }));

    const { result } = renderHook(() =>
      useSessionHeartbeat({ enabled: true, warningBeforeExpirySec: 300 }),
    );
    await advanceTimers(0);
    expect(result.current.showWarning).toBe(true);

    // Simulate another tab broadcasting a fresh expiresAt
    const sender = new MockBroadcastChannel('session-heartbeat');
    act(() => {
      sender.postMessage({ expiresAt: now + 1800 });
    });

    expect(result.current.showWarning).toBe(false);
    sender.close();
  });

  it('closes BroadcastChannel on unmount', async () => {
    renderHook(() => useSessionHeartbeat({ enabled: true }));
    await advanceTimers(0);

    const channel = MockBroadcastChannel.instances.find((i) => i.name === 'session-heartbeat');
    expect(channel).toBeDefined();
    expect(channel!.closed).toBe(false);
  });
});
