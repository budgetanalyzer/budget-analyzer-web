import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdown } from '@/hooks/useCountdown';

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns correct seconds remaining', () => {
    const now = Math.floor(Date.now() / 1000);
    const { result } = renderHook(() => useCountdown(now + 90, true));
    expect(result.current).toBe(90);
  });

  it('ticks down with fake timers', () => {
    const now = Math.floor(Date.now() / 1000);
    const { result } = renderHook(() => useCountdown(now + 5, true));
    expect(result.current).toBe(5);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(4);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(2);
  });

  it('returns 0 when active is false', () => {
    const now = Math.floor(Date.now() / 1000);
    const { result } = renderHook(() => useCountdown(now + 60, false));
    expect(result.current).toBe(0);
  });

  it('returns 0 when expiresAt is null', () => {
    const { result } = renderHook(() => useCountdown(null, true));
    expect(result.current).toBe(0);
  });

  it('floors at 0 and never goes negative', () => {
    const now = Math.floor(Date.now() / 1000);
    const { result } = renderHook(() => useCountdown(now + 1, true));
    expect(result.current).toBe(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(0);
  });

  it('cleans up interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const now = Math.floor(Date.now() / 1000);
    const { unmount } = renderHook(() => useCountdown(now + 60, true));
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
