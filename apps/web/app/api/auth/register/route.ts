import { NextResponse } from 'next/server';

import { ApiError, authApi } from '@/lib/api';
import { AUTH_COOKIE } from '@/lib/constants';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await authApi.register(body);

    const response = NextResponse.json(data);
    const secure =
      process.env.AUTH_COOKIE_SECURE === 'true' ||
      (process.env.WEB_URL ?? process.env.NEXT_PUBLIC_WEB_URL ?? '').startsWith('https://');

    response.cookies.set(AUTH_COOKIE, data.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Не удалось зарегистрироваться';
    const status = err instanceof ApiError ? err.status : 400;
    return NextResponse.json({ message }, { status: status >= 400 ? status : 400 });
  }
}
