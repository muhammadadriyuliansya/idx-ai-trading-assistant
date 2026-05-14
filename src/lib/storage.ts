"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [stored, setStored] = useState<T>(initialValue);
  const hydrated = useRef(false);

  // Keep latest initialValue accessible inside the hydration effect without
  // making it a dependency. Callers commonly pass inline object/array
  // literals (`[]`, `DEFAULT_SETTINGS`), which would otherwise create a new
  // reference every render and re-trigger the effect → setStored → re-render
  // → infinite loop that freezes the main thread (menus unclickable, fetches
  // never fire). The hook intentionally only consumes initialValue once per
  // key, on first hydration.
  const initialRef = useRef(initialValue);
  initialRef.current = initialValue;

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Re-hydrate when key changes (e.g. dynamic keys in lists).
    hydrated.current = false;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T;
        const init = initialRef.current;
        // Merge with defaults for plain objects so new fields never end up
        // undefined after a schema change.
        const merged =
          typeof init === "object" &&
          init !== null &&
          !Array.isArray(init)
            ? { ...init, ...parsed }
            : parsed;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStored(merged as T);
      } else {
        // No stored value → reset to current default for this key.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStored(initialRef.current);
      }
    } catch {
      // ignore parse errors
    } finally {
      hydrated.current = true;
    }
    // initialValue intentionally excluded — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next =
          typeof value === "function"
            ? (value as (p: T) => T)(prev)
            : value;
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(key, JSON.stringify(next));
          } catch {
            // storage full or blocked
          }
        }
        return next;
      });
    },
    [key],
  );

  const remove = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
    setStored(initialRef.current);
  }, [key]);

  return [stored, setValue, remove];
}

export const STORAGE_KEYS = {
  settings: "idxai.settings",
  scanner: "idxai.form.scanner",
  risk: "idxai.form.risk",
  context: "idxai.form.context",
  decision: "idxai.form.decision",
  journal: "idxai.form.journal",
  setups: "idxai.setups",
  trades: "idxai.trades",
  prompts: "idxai.prompts",
} as const;
