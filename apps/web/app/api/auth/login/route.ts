import { NextResponse } from 'next/server';

import { authApi } from '@/lib/api';
import { AUTH_COOKIE } from '@/lib/constants';

export async function POST(request: Request) {
  try {
    const { email, password } = (await request.json()) as { email: string; password: string };
    const data = await authApi.login(email, password);

    const response = NextResponse.json(data);
    response.cookies.set(AUTH_COOKIE, data.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка входа';
    return NextResponse.json({ message }, { status: 401 });
  }
}
