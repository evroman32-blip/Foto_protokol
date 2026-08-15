import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserAccountStatus, UserRole } from '@mandarin/contracts';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

export const ACCENT_COLORS = [
  '#e85d04',
  '#1d4ed8',
  '#15803d',
  '#7c3aed',
  '#be185d',
  '#0f766e',
  '#b45309',
  '#334155',
  '#dc2626',
  '#0369a1',
] as const;

export const REGISTERABLE_ROLES: UserRole[] = [
  UserRole.CHIEF_DOCTOR,
  UserRole.ORTHOPEDIC_MANAGER,
  UserRole.SURGEON,
  UserRole.ORTHOPEDIST,
  UserRole.CONSULTING_DOCTOR,
  UserRole.DENTAL_TECHNICIAN,
  UserRole.ASSISTANT,
  UserRole.RADIOLOGY_OPERATOR,
  UserRole.EXPERT,
];

export const USER_ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: 'Администратор',
  CHIEF_DOCTOR: 'Главный врач',
  ORTHOPEDIC_MANAGER: 'Ортопед-менеджер',
  SURGEON: 'Хирург',
  ORTHOPEDIST: 'Ортопед',
  CONSULTING_DOCTOR: 'Консультирующий врач',
  DENTAL_TECHNICIAN: 'Зубной техник',
  ASSISTANT: 'Ассистент',
  RADIOLOGY_OPERATOR: 'Рентген-лаборант',
  AUDITOR: 'Аудитор',
  EXPERT: 'Эксперт',
};

export const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает подтверждения',
  APPROVED: 'Подтверждён',
  REJECTED: 'Отклонён',
};

export interface RegisterInput {
  lastName: string;
  firstName: string;
  middleName?: string;
  phone: string;
  email: string;
  password: string;
  requestedRole: UserRole;
  accentColor: string;
}

export interface UpdateProfileInput {
  lastName?: string;
  firstName?: string;
  middleName?: string | null;
  phone?: string | null;
  email?: string;
  password?: string;
  accentColor?: string;
}

function toAuthUser(user: {
  id: string;
  email: string;
  role: string;
  staffMemberId: string | null;
  accountStatus: string;
  requestedRole: string | null;
  staffMember?: { branchId: string | null } | null;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    staffMemberId: user.staffMemberId,
    branchId: user.staffMember?.branchId ?? null,
    accountStatus: user.accountStatus,
    requestedRole: user.requestedRole,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  async validateUser(email: string, password: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { staffMember: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const authUser = toAuthUser(user);
    await this.audit.log({
      actorUserId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });
    return authUser;
  }

  signToken(user: AuthUser): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      staffMemberId: user.staffMemberId,
      branchId: user.branchId,
    });
  }

  async register(dto: RegisterInput) {
    if (!REGISTERABLE_ROLES.includes(dto.requestedRole)) {
      throw new BadRequestException('Эту роль нельзя выбрать при регистрации');
    }
    if (!ACCENT_COLORS.includes(dto.accentColor as (typeof ACCENT_COLORS)[number])) {
      throw new BadRequestException('Выберите цвет кнопки аккаунта из палитры');
    }

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Пользователь с такой почтой уже зарегистрирован');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const position = USER_ROLE_LABELS[dto.requestedRole] ?? 'Сотрудник';

    const staff = await this.prisma.staffMember.create({
      data: {
        lastName: dto.lastName.trim(),
        firstName: dto.firstName.trim(),
        middleName: dto.middleName?.trim() || null,
        position,
      },
    });

    const user = await this.prisma.user.create({
      data: {
        email,
        phone: dto.phone.trim(),
        passwordHash,
        role: UserRole.EXPERT,
        requestedRole: dto.requestedRole,
        accountStatus: UserAccountStatus.PENDING,
        accentColor: dto.accentColor,
        staffMemberId: staff.id,
      },
      include: { staffMember: { include: { branch: true } } },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'auth.register',
      entityType: 'user',
      entityId: user.id,
      metadata: {
        email: user.email,
        requestedRole: dto.requestedRole,
      },
    });

    const authUser = toAuthUser(user);
    return {
      accessToken: this.signToken(authUser),
      user: this.mapProfile(user),
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        staffMember: { include: { branch: true } },
      },
    });
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }
    return this.mapProfile(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileInput) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { staffMember: true },
    });
    if (!user) throw new UnauthorizedException('Пользователь не найден');

    if (dto.accentColor && !ACCENT_COLORS.includes(dto.accentColor as (typeof ACCENT_COLORS)[number])) {
      throw new BadRequestException('Выберите цвет кнопки аккаунта из палитры');
    }

    let email = user.email;
    if (dto.email) {
      email = dto.email.trim().toLowerCase();
      if (email !== user.email) {
        const taken = await this.prisma.user.findUnique({ where: { email } });
        if (taken) throw new ConflictException('Эта почта уже занята');
      }
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;

    if (user.staffMemberId && (dto.lastName || dto.firstName || dto.middleName !== undefined)) {
      await this.prisma.staffMember.update({
        where: { id: user.staffMemberId },
        data: {
          lastName: dto.lastName?.trim() ?? undefined,
          firstName: dto.firstName?.trim() ?? undefined,
          middleName: dto.middleName === undefined ? undefined : dto.middleName?.trim() || null,
        },
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email,
        phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
        accentColor: dto.accentColor,
        passwordHash,
      },
    });

    return this.getProfile(userId);
  }

  mapProfile(user: {
    id: string;
    email: string;
    phone: string | null;
    role: string;
    requestedRole: string | null;
    accountStatus: string;
    accentColor: string;
    lastLoginAt: Date | null;
    staffMember: {
      lastName: string;
      firstName: string;
      middleName: string | null;
      position: string;
      branch?: { id: string; name: string } | null;
    } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      roleLabel: USER_ROLE_LABELS[user.role] ?? user.role,
      requestedRole: user.requestedRole,
      requestedRoleLabel: user.requestedRole
        ? (USER_ROLE_LABELS[user.requestedRole] ?? user.requestedRole)
        : null,
      accountStatus: user.accountStatus ?? 'APPROVED',
      accountStatusLabel:
        ACCOUNT_STATUS_LABELS[user.accountStatus ?? 'APPROVED'] ?? user.accountStatus,
      accentColor: user.accentColor || '#e85d04',
      lastLoginAt: user.lastLoginAt,
      lastName: user.staffMember?.lastName ?? '',
      firstName: user.staffMember?.firstName ?? '',
      middleName: user.staffMember?.middleName ?? null,
      position: user.staffMember?.position ?? null,
      branch: user.staffMember?.branch ?? null,
      isReadOnly: user.role === UserRole.EXPERT,
    };
  }
}
