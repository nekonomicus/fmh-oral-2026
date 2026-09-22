'use client';

import { useEffect, useState } from 'react';
import { smartSearch } from './search';

const DEBOUNCE_MS = 650;

/** Runs the Gemini search a moment after typing stops. Returns matching ids and a busy flag. */
export function useSmartSearch(query: string, code: string | null) {
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const trimmed = query.trim();

  useEffect(() => {
    if (!code || trimmed.length < 3) {
      const reset = window.setTimeout(() => {
        setIds([]);
        setBusy(false);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setBusy(true);
      smartSearch(trimmed, code, controller.signal)
        .then((found) => {
          if (!controller.signal.aborted) setIds(found);
        })
        .catch(() => {
          if (!controller.signal.aborted) setIds([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed, code]);

  return { ids, busy };
}
