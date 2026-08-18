'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  BRAND,
  ACCENT_COLORS,
  JOB_TITLES,
  JOB_TITLES_REQUIRING_SPECIALIZATION,
  SPECIALIZATIONS,
  jobTitleRequiresSpecialization,
} from '@/lib/constants';
import { authApi } from '@/lib/api';
import { getStoredToken, registerAccount } from '@/lib/auth';

export default function RegisterPage() {
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isExpert, setIsExpert] = useState(false);
  const [position, setPosition] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [accentColor, setAccentColor] = useState('#e85d04');
  const [jobTitles, setJobTitles] = useState<string[]>([...JOB_TITLES]);
  const [specializations, setSpecializations] = useState<string[]>([...SPECIALIZATIONS]);
  const [colors, setColors] = useState<string[]>([...ACCENT_COLORS]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showSpecialization = !isExpert && Boolean(position) && jobTitleRequiresSpecialization(position);
  const passwordsMismatch =
    password.length > 0 && passwordConfirm.length > 0 && password !== passwordConfirm;

  const needsSpecializationList = useMemo(
    () => new Set<string>(JOB_TITLES_REQUIRING_SPECIALIZATION),
    [],
  );

  useEffect(() => {
    if (!getStoredToken()) return;
    void authApi
      .me()
      .then(() => {
        window.location.replace('/dashboard');
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void authApi
      .registerOptions()
      .then((opts) => {
        if (opts.jobTitles?.length) setJobTitles(opts.jobTitles);
        if (opts.specializations?.length) setSpecializations(opts.specializations);
        setColors(opts.accentColors);
        if (opts.accentColors[0]) setAccentColor(opts.accentColors[0]);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!position || !needsSpecializationList.has(position)) {
      setSpecialization('');
    }
  }, [position, needsSpecializationList]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== passwordConfirm) {
      setError('Пароли не совпадают, необходим повторный ввод');
      return;
    }
    if (!isExpert && !position) {
      setError('Выберите должность');
      return;
    }
    if (!isExpert && jobTitleRequiresSpecialization(position) && !specialization) {
      setError('Выберите специализацию');
      return;
    }
    setLoading(true);
    try {
      await registerAccount({
        lastName,
        firstName,
        middleName: middleName || undefined,
        phone,
        email,
        password,
        passwordConfirm,
        isExpert,
        position: isExpert ? undefined : position,
        specialization: isExpert || !showSpecialization ? undefined : specialization,
        accentColor,
      });
      window.location.replace('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось зарегистрироваться';
      if (getStoredToken() && message.includes('уже зарегистрирован')) {
        window.location.replace('/dashboard');
        return;
      }
      setError(message);
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
            Сотрудники клиники получают рабочие права после подтверждения модератором.
            Статус Эксперта подтверждения не требует и даёт только просмотр.
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
            <div className="label-field">Эксперт</div>
            <label htmlFor="isExpert" className="mt-2 flex items-start gap-3 text-sm text-graphite">
              <input
                id="isExpert"
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-accent"
                checked={isExpert}
                onChange={(e) => setIsExpert(e.target.checked)}
              />
              <span>Если Вы не являетесь сотрудником клиники Мандарин, выберите статус Эксперта.</span>
            </label>
          </div>

          {!isExpert ? (
            <>
              <div>
                <label className="label-field" htmlFor="position">
                  Должность
                </label>
                <select
                  id="position"
                  required
                  className="input-field"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                >
                  <option value="">Выберите должность</option>
                  {jobTitles.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                </select>
              </div>

              {showSpecialization ? (
                <div>
                  <label className="label-field" htmlFor="specialization">
                    Специализация
                  </label>
                  <select
                    id="specialization"
                    required
                    className="input-field"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                  >
                    <option value="">Выберите специализацию</option>
                    {specializations.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </>
          ) : null}

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
            <label className="label-field" htmlFor="passwordConfirm">
              Подтверждение пароля
            </label>
            <input
              id="passwordConfirm"
              required
              type="password"
              minLength={8}
              className="input-field"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
            {passwordsMismatch ? (
              <p className="mt-1 text-sm text-status-danger">
                Пароли не совпадают, необходим повторный ввод
              </p>
            ) : null}
          </div>

          <div>
            <div className="label-field">Цвет логотипа Вашего аккаунта</div>
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

          <button type="submit" disabled={loading || passwordsMismatch} className="btn-primary w-full">
            {loading ? 'Регистрация…' : 'Создать аккаунт'}
          </button>

          <p className="text-center text-sm text-gray-600">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="text-accent hover:underline">
              Войти
            </Link>
          </p>
          <p className="text-center text-sm text-gray-600">
            <Link href="/home" className="text-accent hover:underline">
              На главную
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
