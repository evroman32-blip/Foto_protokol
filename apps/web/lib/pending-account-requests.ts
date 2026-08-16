'use client';

import { useCallback, useEffect, useState } from 'react';

import { adminApi } from './api';

export const ACCOUNT_REQUESTS_CHANGED_EVENT = 'mandarin:account-requests-changed';

export function notifyAccountRequestsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ACCOUNT_REQUESTS_CHANGED_EVENT));
}

export function usePendingAccountRequestCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!enabled) {
      setCount(0);
      return;
    }
    try {
      const rows = await adminApi.accountRequests('PENDING');
      setCount(rows.length);
    } catch {
      /* keep last known count */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    const onChanged = () => void load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener(ACCOUNT_REQUESTS_CHANGED_EVENT, onChanged);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(ACCOUNT_REQUESTS_CHANGED_EVENT, onChanged);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, load]);

  return count;
}
