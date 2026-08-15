'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { BRAND, USER_ROLE_LABELS, ACCENT_COLORS } from '@/lib/constants';
import { authApi } from '@/lib/api';
import { setStoredToken } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [requestedRole, setRequestedRole] = useState('EXPERT');
  const [accentColor, setAccentColor] = useState('#e85d04');
  const [roles, setRoles] = useState<{ value: string; label: string }[]>(
    Object.entries(USER_ROLE_LABELS)
      .filter(([value]) => value !== 'SYSTEM_ADMIN' && value !== 'AUDITOR')
      .map(([value, label]) => ({ value, label })),
  );
  const [colors, setColors] = useState<string[]>([...ACCENT_COLORS]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void authApi
      .registerOptions()
      .then((opts) => {
        setRoles(opts.roles);
        setColors(opts.accentColors);
        if (opts.accentColors[0]) setAccentColor(opts.accentColors[0]);
      })
      .catch(() => undefined);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await authApi.register({
        lastName,
        firstName,
        middleName: middleName || undefined,
        phone,
        email,
        password,
        requestedRole,
        accentColor,
      });
      setStoredToken(data.accessToken);
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: data.accessToken }),
      });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось зарегистрироваться');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-graphite">{BRAND.title}</h1>
          <p className="mt-1 text-sm text-accent">{BRAND.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="text-lg font-semibold">Регистрация аккаунта</h2>
          <p className="text-sm text-gray-600">
            После регистрации вы сразу можете войти в режиме просмотра. Запрошенный статус
            включит администратор или главный врач.
          </p>

          {error ? <div className="alert-error">{error}</div> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label-field" htmlFor="lastName">
                Фамилия
              </label>
              <input
                id="lastName"
                required
                className="input-field"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div>
              <label className="label-field" htmlFor="firstName">
                Имя
              </label>
              <input
                id="firstName"
                required
                className="input-field"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label-field" htmlFor="middleName">
              Отчество
            </label>
            <input
              id="middleName"
              className="input-field"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
            />
          </div>

          <div>
            <label className="label-field" htmlFor="phone">
              Телефон
            </label>
            <input
              id="phone"
              required
              type="tel"
              className="input-field"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="label-field" htmlFor="email">
              Эл. почта
            </label>
            <input
              id="email"
              required
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="label-field" htmlFor="password">
              Пароль
            </label>
            <input
              id="password"
              required
              type="password"
              minLength={8}
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="label-field" htmlFor="role">
              Статус
            </label>
            <select
              id="role"
              className="input-field"
              value={requestedRole}
              onChange={(e) => setRequestedRole(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="label-field">Цвет кнопки аккаунта</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  className={`h-8 w-8 rounded-full ring-offset-2 ${
                    accentColor === c ? 'ring-2 ring-graphite' : 'ring-1 ring-border'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setAccentColor(c)}
                />
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Регистрация…' : 'Создать аккаунт'}
          </button>

          <p className="text-center text-sm text-gray-600">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="text-accent hover:underline">
              Войти
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
