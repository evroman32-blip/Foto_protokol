import { Body, Controller, Get, Patch, Post, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  ACCEPTED_JOB_TITLES,
  JOB_TITLES,
  JOB_TITLES_REQUIRING_SPECIALIZATION,
  SPECIALIZATIONS,
  STAFF_CLINICAL_ROLE_LABELS,
  StaffClinicalRole,
  jobTitleRequiresSpecialization,
} from '@mandarin/contracts';
import {
  AllowReadonlyMutation,
  AuditAction,
  Public,
  SkipAudit,
} from '../../common/decorators/metadata.decorators';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import {
  ACCENT_COLORS,
  ACCOUNT_STATUS_LABELS,
  AuthService,
  REGISTERABLE_ROLES,
  USER_ROLE_LABELS,
} from './auth.service';

class LoginDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов' })
  password!: string;
}

class RegisterDto {
  @IsString()
  @MinLength(1, { message: 'Укажите фамилию' })
  lastName!: string;

  @IsString()
  @MinLength(1, { message: 'Укажите имя' })
  firstName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsString()
  @MinLength(5, { message: 'Укажите номер телефона' })
  phone!: string;

  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isExpert!: boolean;

  @ValidateIf((dto: RegisterDto) => !dto.isExpert)
  @IsIn([...ACCEPTED_JOB_TITLES], { message: 'Выберите должность из списка' })
  position?: string;

  @ValidateIf(
    (dto: RegisterDto) => !dto.isExpert && Boolean(dto.position && jobTitleRequiresSpecialization(dto.position)),
  )
  @IsIn([...SPECIALIZATIONS], { message: 'Выберите специализацию из списка' })
  specialization?: string;

  @IsString()
  @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов' })
  password!: string;

  @IsString()
  @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов' })
  passwordConfirm!: string;

  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Некорректный цвет кнопки' })
  accentColor!: string;
}

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  middleName?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsEmail({}, { message: 'Некорректный email' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов' })
  password?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Некорректный цвет кнопки' })
  accentColor?: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('register-options')
  registerOptions() {
    return {
      jobTitles: [...JOB_TITLES],
      jobTitlesRequiringSpecialization: [...JOB_TITLES_REQUIRING_SPECIALIZATION],
      specializations: [...SPECIALIZATIONS],
      clinicalRoles: Object.values(StaffClinicalRole).map((value) => ({
        value,
        label: STAFF_CLINICAL_ROLE_LABELS[value],
      })),
      roles: REGISTERABLE_ROLES.map((value) => ({
        value,
        label: USER_ROLE_LABELS[value],
      })),
      accentColors: ACCENT_COLORS,
      accountStatuses: Object.entries(ACCOUNT_STATUS_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    };
  }

  @Public()
  @SkipAudit()
  @Post('register')
  @ApiOperation({ summary: 'Регистрация аккаунта' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.authService.register(dto);
    reply.setCookie('access_token', result.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60,
    });
    return result;
  }

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

  @AllowReadonlyMutation()
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

  @AllowReadonlyMutation()
  @AuditAction('auth.profile.update')
  @Patch('me')
  @ApiOperation({ summary: 'Изменить свой профиль' })
  async updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }
}
