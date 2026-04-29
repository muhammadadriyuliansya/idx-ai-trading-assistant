"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [stored, setStored] = useState<T>(initialValue);
  const hydrated = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStored(JSON.parse(raw) as T);
      }
    } catch {
      // ignore parse errors
    } finally {
      hydrated.current = true;
    }
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
    setStored(initialValue);
  }, [key, initialValue]);

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
