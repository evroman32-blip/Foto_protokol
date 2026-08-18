'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  canCloseStage,
  canCreateClinicalCase,
  canEditClosedStage as canEditClosedStageByRole,
  canEditPatients,
  canEditStaffAndPatients,
  isModeratorRole,
} from '@mandarin/contracts';

import { authApi, type AuthProfileDto } from './api';
import { getStoredToken } from './auth';

export type CurrentUser = AuthProfileDto;

export function canEditClosedStage(role: string | null | undefined): boolean {
  return canEditClosedStageByRole(role);
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
    if (!getStoredToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    void reload();
  }, [reload]);

  const role = user?.role ?? null;
  const approved = user?.accountStatus === 'APPROVED';
  const isExpert = role === 'EXPERT';
  const readOnly = Boolean(user?.isReadOnly) || isReadOnlyRole(role) || !approved;
  const isModerator = isModeratorRole(role);

  return {
    user,
    role,
    loading,
    reload,
    isReadOnly: readOnly,
    isExpert,
    canEditClosedStage: user?.canEditClosedStage ?? (!readOnly && canEditClosedStageByRole(role)),
    canApproveAccounts: isModerator || role === 'CHIEF_DOCTOR',
    canEditStaff: user?.canEditStaffAndPatients ?? (approved && canEditStaffAndPatients(role)),
    canEditPatients:
      user?.canEditPatients ?? (approved && canEditPatients(role, user?.position)),
    canCreateCase:
      user?.canCreateCase ?? (approved && canCreateClinicalCase(role, user?.position)),
    canAssignAccountRole: isModerator,
    canCloseStage: (startedByUserId?: string | null) =>
      Boolean(user && canCloseStage(role, user.id, startedByUserId)),
    canDelete: isModerator,
    isSiteAdmin: isModerator,
    isModerator,
    canEditProfile: approved,
  };
}
