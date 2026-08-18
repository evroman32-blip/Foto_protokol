import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@mandarin/contracts';
import {
  ALLOW_READONLY_MUTATION_KEY,
  IS_PUBLIC_KEY,
} from '../decorators/metadata.decorators';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class ExpertWriteGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allow = this.reflector.getAllAndOverride<boolean>(ALLOW_READONLY_MUTATION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allow) return true;

    const request = context.switchToHttp().getRequest();
    if (SAFE_METHODS.has(String(request.method ?? '').toUpperCase())) return true;

    const user = request.user as { role?: string; accountStatus?: string } | undefined;
    if (!user) return true;

    if (user.role === UserRole.EXPERT || user.accountStatus === 'PENDING') {
      throw new ForbiddenException(
        'Режим просмотра: изменять данные могут только подтверждённые сотрудники. Дождитесь подтверждения прав модератором.',
      );
    }

    return true;
  }
}
