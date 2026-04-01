import { useCallback, useEffect, useRef } from 'react';

const TRACKED_EVENTS: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'touchstart'];

export function useActivityTracking() {
  const activeRef = useRef(false);

  useEffect(() => {
    const markActive = () => {
      activeRef.current = true;
    };

    for (const event of TRACKED_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }
    // scroll doesn't bubble — capture phase catches overflow containers
    window.addEventListener('scroll', markActive, { passive: true, capture: true });

    return () => {
      for (const event of TRACKED_EVENTS) {
        window.removeEventListener(event, markActive);
      }
      window.removeEventListener('scroll', markActive, { capture: true });
    };
  }, []);

  const wasActiveSinceLastCheck = useCallback(() => {
    const wasActive = activeRef.current;
    activeRef.current = false;
    return wasActive;
  }, []);

  return { wasActiveSinceLastCheck };
}
