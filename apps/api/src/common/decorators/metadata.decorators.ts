import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@mandarin/contracts';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const SKIP_AUDIT_KEY = 'skipAudit';
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);

export const AUDIT_ACTION_KEY = 'auditAction';
export const AuditAction = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);

/** Разрешить EXPERT / неподтверждённым мутацию (профиль, выход). */
export const ALLOW_READONLY_MUTATION_KEY = 'allowReadonlyMutation';
export const AllowReadonlyMutation = () => SetMetadata(ALLOW_READONLY_MUTATION_KEY, true);
