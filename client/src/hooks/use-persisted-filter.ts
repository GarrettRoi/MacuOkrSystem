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
