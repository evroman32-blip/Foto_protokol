import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getEnv } from '@mandarin/config';
import { PrismaService } from '../../common/services/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  staffMemberId: string | null;
  branchId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) =>
          req?.cookies?.mandarin_auth_token ??
          req?.cookies?.access_token ??
          null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: getEnv().JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { staffMember: true },
    });
    if (!user || !user.isActive) {
      return null as unknown as AuthUser;
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      staffMemberId: user.staffMemberId,
      branchId: user.staffMember?.branchId ?? null,
    };
  }
}
