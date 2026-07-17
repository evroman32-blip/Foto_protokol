import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@mandarin/contracts';
import { ROLES_KEY } from '../decorators/metadata.decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Доступ запрещён');
    }

    if (user.role === UserRole.SYSTEM_ADMIN || user.role === UserRole.AUDITOR) {
      return true;
    }

    if (!requiredRoles.includes(user.role as UserRole)) {
      throw new ForbiddenException('Недостаточно прав для выполнения операции');
    }

    return true;
  }
}
