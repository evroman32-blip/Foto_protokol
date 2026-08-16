'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { staffApi } from '@/lib/api';
import {
  JOB_TITLES,
  SPECIALIZATIONS,
  STAFF_CLINICAL_ROLE_LABELS,
  USER_ROLE_LABELS,
  jobTitleRequiresSpecialization,
} from '@/lib/constants';
import { useCurrentUser } from '@/lib/use-current-user';

const CLINICAL_ROLE_OPTIONS = Object.entries(STAFF_CLINICAL_ROLE_LABELS);
const ACCOUNT_ROLE_OPTIONS = Object.entries(USER_ROLE_LABELS).filter(
  ([value]) => value !== 'SYSTEM_ADMIN',
);

export default function NewStaffPage() {
  const router = useRouter();
  const { canEditStaff, loading: userLoading } = useCurrentUser();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [position, setPosition] = useState('');
  const [specialization, setSpecialization] = useState('');

  function toggleRole(role: string) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEditStaff) return;
    setError(null);
    if (!position) {
      setError('Выберите должность');
      return;
    }
    if (jobTitleRequiresSpecialization(position) && !specialization) {
      setError('Выберите специализацию');
      return;
    }
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const member = await staffApi.create({
        lastName: String(fd.get('lastName')),
        firstName: String(fd.get('firstName')),
        middleName: String(fd.get('middleName') || '') || undefined,
        position,
        specialization: jobTitleRequiresSpecialization(position) ? specialization : undefined,
        clinicalRoles: roles,
        userRole: String(fd.get('userRole') || '') || undefined,
      });
      router.push(`/staff/${member.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  }

  if (!userLoading && !canEditStaff) {
    return (
      <div>
        <PageHeader title="Новый сотрудник" />
        <div className="alert-error">Создавать карточку сотрудника может только администратор сайта.</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Новый сотрудник"
        actions={
          <Link href="/staff" className="btn-secondary">
            Назад
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="card max-w-2xl space-y-4">
        {error ? <div className="alert-error">{error}</div> : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label-field" htmlFor="lastName">
              Фамилия *
            </label>
            <input id="lastName" name="lastName" required className="input-field" />
          </div>
          <div>
            <label className="label-field" htmlFor="firstName">
              Имя *
            </label>
            <input id="firstName" name="firstName" required className="input-field" />
          </div>
          <div>
            <label className="label-field" htmlFor="middleName">
              Отчество
            </label>
            <input id="middleName" name="middleName" className="input-field" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field" htmlFor="position">
              Должность *
            </label>
            <select
              id="position"
              required
              className="input-field"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="">Выберите должность</option>
              {JOB_TITLES.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          </div>
          {position && jobTitleRequiresSpecialization(position) ? (
            <div>
              <label className="label-field" htmlFor="specialization">
                Специализация *
              </label>
              <select
                id="specialization"
                required
                className="input-field"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
              >
                <option value="">Выберите специализацию</option>
                {SPECIALIZATIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div>
          <span className="label-field">Роли</span>
          <div className="mt-2 flex flex-wrap gap-3">
            {CLINICAL_ROLE_OPTIONS.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={roles.includes(value)}
                  onChange={() => toggleRole(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label-field" htmlFor="userRole">
            Права доступа в системе
          </label>
          <select id="userRole" name="userRole" className="input-field" defaultValue="">
            <option value="">Назначить позже</option>
            {ACCOUNT_ROLE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Сохранение…' : 'Сохранить'}
          </button>
          <Link href="/staff" className="btn-secondary">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  );
}
