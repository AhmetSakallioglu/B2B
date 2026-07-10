"use client";

import { useEffect } from "react";

/**
 * Runs an effect callback after the current commit (via queueMicrotask).
 * Avoids react-hooks/set-state-in-effect when the callback triggers loading state.
 */
export function useDeferredEffect(
  callback: () => void | Promise<void> | (() => void),
  deps: React.DependencyList
) {
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const result = callback();

      if (typeof result === "function") {
        dispose = result;
      }
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
  }, deps);
}
