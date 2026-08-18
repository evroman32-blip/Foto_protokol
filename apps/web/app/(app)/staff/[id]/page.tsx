'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { staffApi, type StaffDto } from '@/lib/api';
import { confirmDelete } from '@/lib/confirm-delete';
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

function formatStaff(s: StaffDto) {
  return [s.lastName, s.firstName, s.middleName].filter(Boolean).join(' ');
}

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { canEditStaff, isSiteAdmin, canAssignAccountRole } = useCurrentUser();
  const [member, setMember] = useState<StaffDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [position, setPosition] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [userRole, setUserRole] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await staffApi.get(id);
      setMember(data);
      setRoles(data.clinicalRoles ?? data.roles ?? []);
      setPosition(data.position ?? '');
      setSpecialization(data.specialization ?? '');
      setUserRole(data.user?.role ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function handleDelete() {
    if (
      !(await confirmDelete(
        'Удалить карточку сотрудника? Если сотрудник участвует в клиническом случае, удаление будет запрещено.',
      ))
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await staffApi.remove(id);
      router.push('/staff');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить карточку');
      setDeleting(false);
    }
  }

  function toggleRole(role: string) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!member || !canEditStaff) return;
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await staffApi.update(id, {
        lastName: String(fd.get('lastName')),
        firstName: String(fd.get('firstName')),
        middleName: String(fd.get('middleName') || '') || undefined,
        position,
        specialization: jobTitleRequiresSpecialization(position) ? specialization || undefined : undefined,
        clinicalRoles: roles,
        userRole: canAssignAccountRole ? userRole || undefined : undefined,
      });
      router.push('/staff');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && !member) return <ErrorState message={error} onRetry={load} />;
  if (!member) return null;

  const showSpecialization = Boolean(position) && jobTitleRequiresSpecialization(position);
  const positionOptions = JOB_TITLES.includes(position as (typeof JOB_TITLES)[number])
    ? [...JOB_TITLES]
    : position
      ? [position, ...JOB_TITLES]
      : [...JOB_TITLES];

  return (
    <div>
      <PageHeader
        title={formatStaff(member)}
        actions={
          <div className="flex gap-2">
            <Link href="/staff" className="btn-secondary">
              К списку
            </Link>
            {isSiteAdmin ? (
              <button type="button" className="btn-danger" disabled={deleting} onClick={() => void handleDelete()}>
                {deleting ? 'Удаление…' : 'Удалить'}
              </button>
            ) : null}
          </div>
        }
      />

      {error ? <div className="alert-error mb-4">{error}</div> : null}
      {!canEditStaff ? (
        <div className="mb-4 rounded border border-border bg-surface-muted px-4 py-3 text-sm">
          Карточку сотрудника могут редактировать модератор, исполнительный директор,
          управляющий клиникой, администратор клиники и главный врач. Роль аккаунта
          назначает только модератор.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="card max-w-2xl space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label-field" htmlFor="lastName">
              Фамилия
            </label>
            <input
              id="lastName"
              name="lastName"
              defaultValue={member.lastName}
              required
              disabled={!canEditStaff}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field" htmlFor="firstName">
              Имя
            </label>
            <input
              id="firstName"
              name="firstName"
              defaultValue={member.firstName}
              required
              disabled={!canEditStaff}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field" htmlFor="middleName">
              Отчество
            </label>
            <input
              id="middleName"
              name="middleName"
              defaultValue={member.middleName ?? ''}
              disabled={!canEditStaff}
              className="input-field"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field" htmlFor="position">
              Должность
            </label>
            <select
              id="position"
              className="input-field"
              disabled={!canEditStaff}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="">Выберите должность</option>
              {positionOptions.map((title) => (
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
                className="input-field"
                disabled={!canEditStaff}
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
                  disabled={!canEditStaff}
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
          <p className="mb-1 text-xs text-gray-500">
            Модератор — полные права управления сайтом. Генеральный директор имеет те же права.
            Не путать с должностью «Администратор клиники».
          </p>
          <select
            id="userRole"
            className="input-field"
            disabled={!canAssignAccountRole || !member.user}
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
          >
            <option value="">{member.user ? 'Выберите роль' : 'Аккаунт не создан'}</option>
            {ACCOUNT_ROLE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {canEditStaff ? (
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Сохранение…' : 'Сохранить изменения'}
          </button>
        ) : null}
      </form>
    </div>
  );
}
