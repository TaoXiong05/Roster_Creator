import { useEffect, useState } from 'react';

/**
 * Keeps a conditionally-shown element mounted long enough for its exit
 * transition to finish, and defers the "visible" flag by one frame on
 * mount so the enter transition has a closed state to animate from.
 */
export function useTransitionPresence(show: boolean, duration = 300) {
  const [mounted, setMounted] = useState(show);
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setMounted(true);
      // A macrotask (not requestAnimationFrame) so the closed state still
      // paints even in a backgrounded/non-composited tab, where rAF can
      // stall indefinitely — the enter transition must not depend on it.
      const timeout = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timeout);
    }
    setVisible(false);
    const timeout = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(timeout);
  }, [show, duration]);

  return { mounted, visible };
}
