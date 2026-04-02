import { useEffect, useState } from 'react';

function calcRemaining(expiresAt: number): number {
  return Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
}

export function useCountdown(expiresAt: number | null, active: boolean): number {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!active || expiresAt == null) {
      setSecondsLeft(0);
      return;
    }

    setSecondsLeft(calcRemaining(expiresAt));
    const id = setInterval(() => {
      setSecondsLeft(calcRemaining(expiresAt));
    }, 1000);

    return () => clearInterval(id);
  }, [expiresAt, active]);

  return secondsLeft;
}
