import { useEffect, useRef } from 'react';
import { usePageVisible } from './usePageVisible';

/** Polls only while the tab is visible; skips the first immediate run if `immediate` is false. */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
  immediate = true,
): void {
  const visible = usePageVisible();
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled || !visible) return;

    if (immediate) void saved.current();

    const id = setInterval(() => void saved.current(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, visible, intervalMs, immediate]);
}
