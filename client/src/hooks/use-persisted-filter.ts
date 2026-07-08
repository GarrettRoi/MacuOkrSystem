import { useState, useCallback } from "react";

export function usePersistedFilter(storageKey: string, defaultValue: string): [string, (val: string) => void] {
  const [value, setValue] = useState<string>(() => {
    try {
      return localStorage.getItem(storageKey) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setPersistedValue = useCallback((val: string) => {
    setValue(val);
    try {
      if (val === defaultValue) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, val);
      }
    } catch {}
  }, [storageKey, defaultValue]);

  return [value, setPersistedValue];
}

// Multi-value variant: persists a string[] as JSON. An empty array means
// "no filter" (All) and clears the storage entry.
export function usePersistedMultiFilter(storageKey: string): [string[], (val: string[]) => void] {
  const [value, setValue] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  });

  const setPersistedValue = useCallback((val: string[]) => {
    setValue(val);
    try {
      if (val.length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(val));
      }
    } catch {}
  }, [storageKey]);

  return [value, setPersistedValue];
}
