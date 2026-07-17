'use client';

import { AUTH_TOKEN_KEY } from './constants';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  staffMemberId?: string | null;
  firstName?: string;
  lastName?: string;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Ошибка входа');
  }

  const data = (await res.json()) as { accessToken: string; user: AuthUser };
  setStoredToken(data.accessToken);
  return data.user;
}

export async function logout(): Promise<void> {
  clearStoredToken();
  await fetch('/api/auth/logout', { method: 'POST' });
}
