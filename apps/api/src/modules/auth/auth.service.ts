import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/services/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      staffMemberId: user.staffMemberId,
      branchId: user.staffMember?.branchId ?? null,
    };
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
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      staffMember: user.staffMember,
    };
  }
}
