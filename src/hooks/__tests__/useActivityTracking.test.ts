import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { useActivityTracking } from '@/hooks/useActivityTracking';

describe('useActivityTracking', () => {
  it('returns false when no user activity has occurred', () => {
    const { result } = renderHook(() => useActivityTracking());
    expect(result.current.wasActiveSinceLastCheck()).toBe(false);
  });

  it('returns true after mousemove event', () => {
    const { result } = renderHook(() => useActivityTracking());
    fireEvent.mouseMove(window);
    expect(result.current.wasActiveSinceLastCheck()).toBe(true);
  });

  it('returns true after keydown event', () => {
    const { result } = renderHook(() => useActivityTracking());
    fireEvent.keyDown(window);
    expect(result.current.wasActiveSinceLastCheck()).toBe(true);
  });

  it('returns true after click event', () => {
    const { result } = renderHook(() => useActivityTracking());
    fireEvent.click(window);
    expect(result.current.wasActiveSinceLastCheck()).toBe(true);
  });

  it('returns true after scroll event on window', () => {
    const { result } = renderHook(() => useActivityTracking());
    fireEvent.scroll(window);
    expect(result.current.wasActiveSinceLastCheck()).toBe(true);
  });

  it('returns true after scroll event on overflow container (capture phase)', () => {
    const { result } = renderHook(() => useActivityTracking());
    const container = document.createElement('div');
    document.body.appendChild(container);
    fireEvent.scroll(container);
    expect(result.current.wasActiveSinceLastCheck()).toBe(true);
    document.body.removeChild(container);
  });

  it('returns true after touchstart event', () => {
    const { result } = renderHook(() => useActivityTracking());
    fireEvent.touchStart(window);
    expect(result.current.wasActiveSinceLastCheck()).toBe(true);
  });

  it('resets to false after wasActiveSinceLastCheck is called', () => {
    const { result } = renderHook(() => useActivityTracking());
    fireEvent.click(window);
    expect(result.current.wasActiveSinceLastCheck()).toBe(true);
    expect(result.current.wasActiveSinceLastCheck()).toBe(false);
  });

  it('cleans up event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useActivityTracking());

    const addedEvents = addSpy.mock.calls.map((call) => call[0]);
    expect(addedEvents).toContain('mousemove');
    expect(addedEvents).toContain('keydown');
    expect(addedEvents).toContain('click');
    expect(addedEvents).toContain('scroll');
    expect(addedEvents).toContain('touchstart');

    // Verify scroll listener uses capture phase
    const scrollAddCall = addSpy.mock.calls.find((call) => call[0] === 'scroll');
    expect(scrollAddCall?.[2]).toMatchObject({ capture: true });

    unmount();

    const removedEvents = removeSpy.mock.calls.map((call) => call[0]);
    expect(removedEvents).toContain('mousemove');
    expect(removedEvents).toContain('keydown');
    expect(removedEvents).toContain('click');
    expect(removedEvents).toContain('scroll');
    expect(removedEvents).toContain('touchstart');

    // Verify scroll removal uses capture phase
    const scrollRemoveCall = removeSpy.mock.calls.find((call) => call[0] === 'scroll');
    expect(scrollRemoveCall?.[2]).toMatchObject({ capture: true });

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
