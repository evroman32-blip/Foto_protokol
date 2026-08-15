'use client';

import { useCallback, useEffect, useState } from 'react';

import { authApi, type AuthProfileDto } from './api';

export type CurrentUser = AuthProfileDto;

/** Роли, которым разрешено менять состав файлов уже закрытого этапа. */
export const CLOSED_STAGE_EDITOR_ROLES = ['SYSTEM_ADMIN', 'CHIEF_DOCTOR'];

export function canEditClosedStage(role: string | null | undefined): boolean {
  return Boolean(role && CLOSED_STAGE_EDITOR_ROLES.includes(role));
}

export function isReadOnlyRole(role: string | null | undefined): boolean {
  return role === 'EXPERT';
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const role = user?.role ?? null;
  const readOnly = isReadOnlyRole(role);

  return {
    user,
    role,
    loading,
    reload,
    isReadOnly: readOnly,
    canEditClosedStage: !readOnly && canEditClosedStage(role),
    canApproveAccounts: role === 'SYSTEM_ADMIN' || role === 'CHIEF_DOCTOR',
  };
}
