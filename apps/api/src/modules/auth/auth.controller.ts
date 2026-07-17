import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { Public, SkipAudit } from '../../common/decorators/metadata.decorators';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';

class LoginDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов' })
  password!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @SkipAudit()
  @Post('login')
  @ApiOperation({ summary: 'Вход в систему' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    const token = this.authService.signToken(user);

    reply.setCookie('access_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60,
    });

    return { accessToken: token, user };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Выход из системы' })
  async logout(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.clearCookie('access_token', { path: '/' });
    return { message: 'Выход выполнен' };
  }

  @Get('me')
  @ApiOperation({ summary: 'Текущий пользователь' })
  async me(@CurrentUser() user: AuthUser) {
    return this.authService.getProfile(user.id);
  }
}
