'use client';

import { FormEvent, useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { authApi } from '@/lib/api';
import { ACCENT_COLORS, STAFF_CLINICAL_ROLE_LABELS } from '@/lib/constants';
import { useCurrentUser } from '@/lib/use-current-user';

export default function ProfilePage() {
  const { user, loading, reload, canEditProfile } = useCurrentUser();
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accentColor, setAccentColor] = useState('#e85d04');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLastName(user.lastName);
    setFirstName(user.firstName);
    setMiddleName(user.middleName ?? '');
    setPhone(user.phone ?? '');
    setEmail(user.email);
    setAccentColor(user.accentColor || '#e85d04');
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEditProfile) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await authApi.updateMe({
        lastName,
        firstName,
        middleName,
        phone,
        email,
        accentColor,
        password: password || undefined,
      });
      setPassword('');
      setMessage('Профиль сохранён');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!user) return <ErrorState message="Не удалось загрузить профиль" />;

  const clinicalLabels = (user.clinicalRoles ?? [])
    .map((role) => STAFF_CLINICAL_ROLE_LABELS[role as keyof typeof STAFF_CLINICAL_ROLE_LABELS] ?? role)
    .join(', ');

  return (
    <div>
      <PageHeader
        title="Личный профиль"
        description="После подтверждения администратором можно изменить ФИО, телефон, почту, пароль и цвет кнопки. Должность, специализацию и роли правит только администратор сайта."
      />

      {user.accountStatus === 'PENDING' ? (
        <div className="alert-error mb-4 bg-accent-light text-graphite">
          Заявка на права сотрудника ожидает подтверждения администратором. Сейчас доступен только
          просмотр. Редактирование профиля станет доступно после подтверждения.
        </div>
      ) : null}

      {user.role === 'EXPERT' && user.accountStatus === 'APPROVED' ? (
        <div className="mb-4 rounded border border-border bg-surface-muted px-4 py-3 text-sm text-graphite">
          Статус «Эксперт»: доступен просмотр. Рабочие права клиники не выдаются.
        </div>
      ) : null}

      {error ? <div className="alert-error mb-4">{error}</div> : null}
      {message ? <div className="mb-4 text-sm text-status-success">{message}</div> : null}

      <form onSubmit={handleSubmit} className="card max-w-xl space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label-field">Фамилия</label>
            <input
              className="input-field"
              required
              disabled={!canEditProfile}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div>
            <label className="label-field">Имя</label>
            <input
              className="input-field"
              required
              disabled={!canEditProfile}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label-field">Отчество</label>
          <input
            className="input-field"
            disabled={!canEditProfile}
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
          />
        </div>
        <div>
          <label className="label-field">Телефон</label>
          <input
            className="input-field"
            disabled={!canEditProfile}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label className="label-field">Эл. почта</label>
          <input
            type="email"
            className="input-field"
            required
            disabled={!canEditProfile}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label-field">Должность</label>
          <input className="input-field" value={user.position ?? '—'} disabled />
        </div>
        <div>
          <label className="label-field">Специализация</label>
          <input className="input-field" value={user.specialization ?? '—'} disabled />
        </div>
        <div>
          <label className="label-field">Роли</label>
          <input className="input-field" value={clinicalLabels || '—'} disabled />
        </div>
        <div>
          <label className="label-field">Статус</label>
          <input className="input-field" value={user.roleLabel} disabled />
        </div>
        <div>
          <label className="label-field">Подтверждение прав</label>
          <input className="input-field" value={user.accountStatusLabel} disabled />
        </div>
        <div>
          <label className="label-field">Новый пароль</label>
          <input
            type="password"
            minLength={8}
            className="input-field"
            disabled={!canEditProfile}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Оставьте пустым, чтобы не менять"
          />
        </div>
        <div>
          <div className="label-field">Цвет логотипа Вашего аккаунта</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {ACCENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={!canEditProfile}
                className={`h-8 w-8 rounded-full ${
                  accentColor === c ? 'ring-2 ring-graphite ring-offset-2' : 'ring-1 ring-border'
                }`}
                style={{ backgroundColor: c }}
                onClick={() => setAccentColor(c)}
              />
            ))}
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={busy || !canEditProfile}>
          {busy ? 'Сохранение…' : canEditProfile ? 'Сохранить' : 'Редактирование недоступно'}
        </button>
      </form>
    </div>
  );
}
