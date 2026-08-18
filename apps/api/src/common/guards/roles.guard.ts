import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, isModeratorRole, canCreateClinicalCase, canEditPatients, CASE_CREATOR_ROLES, PATIENT_EDITOR_ROLES } from '@mandarin/contracts';
import { ROLES_KEY, SKIP_ROLES_KEY } from '../decorators/metadata.decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skipRoles = this.reflector.getAllAndOverride<boolean>(SKIP_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipRoles) {
      return true;
    }

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

    if (
      isModeratorRole(user.role)
    ) {
      return true;
    }

    if (!requiredRoles.includes(user.role as UserRole)) {
      const caseCreateEndpoint =
        requiredRoles.length > 0 && requiredRoles.every((role) => CASE_CREATOR_ROLES.includes(role));
      if (caseCreateEndpoint && canCreateClinicalCase(user.role, user.position)) {
        return true;
      }
      const patientEditEndpoint =
        requiredRoles.length > 0 && requiredRoles.every((role) => PATIENT_EDITOR_ROLES.includes(role));
      if (patientEditEndpoint && canEditPatients(user.role, user.position)) {
        return true;
      }
      throw new ForbiddenException('Недостаточно прав для выполнения операции');
    }

    return true;
  }
}
