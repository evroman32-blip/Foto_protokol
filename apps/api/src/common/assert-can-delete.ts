import { ForbiddenException } from '@nestjs/common';
import { isModeratorRole } from '@mandarin/contracts';

import type { AuthUser } from './decorators/current-user.decorator';

export const DELETE_FORBIDDEN = 'Удалять данные может только модератор';

export function assertCanDelete(user: AuthUser | null | undefined): void {
  if (!user || !isModeratorRole(user.role)) {
    throw new ForbiddenException(DELETE_FORBIDDEN);
  }
}
