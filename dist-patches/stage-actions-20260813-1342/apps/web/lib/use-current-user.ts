'use client';

import { useEffect, useState } from 'react';

import { authApi } from './api';

export interface CurrentUser {
  id: string;
  email: string;
  role: string;
}

/** Роли, которым разрешено менять состав файлов уже закрытого этапа. */
export const CLOSED_STAGE_EDITOR_ROLES = ['SYSTEM_ADMIN', 'CHIEF_DOCTOR'];

export function canEditClosedStage(role: string | null | undefined): boolean {
  return Boolean(role && CLOSED_STAGE_EDITOR_ROLES.includes(role));
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const me = await authApi.me();
        if (active) setUser(me);
      } catch {
        // Профиль недоступен — считаем права минимальными.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return {
    user,
    role: user?.role ?? null,
    loading,
    canEditClosedStage: canEditClosedStage(user?.role),
  };
}
