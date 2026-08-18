import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole, canEditStaffAndPatients, isModeratorRole } from '@mandarin/contracts';
import { PrismaService } from '../services/prisma.service';

@Injectable()
export class BranchAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Доступ запрещён');
    }

    if (
      isModeratorRole(user.role) ||
      user.role === UserRole.AUDITOR ||
      canEditStaffAndPatients(user.role)
    ) {
      return true;
    }

    const branchId =
      request.params?.branchId ??
      request.query?.branchId ??
      request.body?.branchId;

    if (!branchId) {
      return true;
    }

    if (user.branchId && user.branchId === branchId) {
      return true;
    }

    throw new ForbiddenException('Нет доступа к указанному филиалу');
  }
}
