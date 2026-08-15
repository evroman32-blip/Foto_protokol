import { NextResponse } from 'next/server';

import { AUTH_COOKIE } from '@/lib/constants';

/** Сохраняет JWT в httpOnly cookie после регистрации (как /api/auth/login). */
export async function POST(request: Request) {
  try {
    const { accessToken } = (await request.json()) as { accessToken?: string };
    if (!accessToken) {
      return NextResponse.json({ message: 'Нет токена' }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true });
    const secure =
      process.env.AUTH_COOKIE_SECURE === 'true' ||
      (process.env.WEB_URL ?? process.env.NEXT_PUBLIC_WEB_URL ?? '').startsWith('https://');

    response.cookies.set(AUTH_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch {
    return NextResponse.json({ message: 'Ошибка сессии' }, { status: 400 });
  }
}
