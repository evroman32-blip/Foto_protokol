'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { staffApi, type StaffDto } from '@/lib/api';
import { PARTICIPANT_ROLE_LABELS } from '@/lib/constants';

const ROLE_OPTIONS = Object.entries(PARTICIPANT_ROLE_LABELS);

function formatStaff(s: StaffDto) {
  return [s.lastName, s.firstName, s.middleName].filter(Boolean).join(' ');
}

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<StaffDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await staffApi.get(id);
      setMember(data);
      setRoles(data.roles ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  function toggleRole(role: string) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!member) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      const updated = await staffApi.update(id, {
        lastName: String(fd.get('lastName')),
        firstName: String(fd.get('firstName')),
        middleName: String(fd.get('middleName') || '') || undefined,
        position: String(fd.get('position') || '') || undefined,
        specialization: String(fd.get('specialization') || '') || undefined,
        roles,
      });
      setMember(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && !member) return <ErrorState message={error} onRetry={load} />;
  if (!member) return null;

  return (
    <div>
      <PageHeader
        title={formatStaff(member)}
        actions={
          <Link href="/staff" className="btn-secondary">
            К списку
          </Link>
        }
      />

      {error ? <div className="alert-error mb-4">{error}</div> : null}

      <form onSubmit={handleSubmit} className="card max-w-2xl space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label-field" htmlFor="lastName">
              Фамилия
            </label>
            <input id="lastName" name="lastName" defaultValue={member.lastName} required className="input-field" />
          </div>
          <div>
            <label className="label-field" htmlFor="firstName">
              Имя
            </label>
            <input id="firstName" name="firstName" defaultValue={member.firstName} required className="input-field" />
          </div>
          <div>
            <label className="label-field" htmlFor="middleName">
              Отчество
            </label>
            <input id="middleName" name="middleName" defaultValue={member.middleName ?? ''} className="input-field" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field" htmlFor="position">
              Должность
            </label>
            <input id="position" name="position" defaultValue={member.position ?? ''} className="input-field" />
          </div>
          <div>
            <label className="label-field" htmlFor="specialization">
              Специализация
            </label>
            <input
              id="specialization"
              name="specialization"
              defaultValue={member.specialization ?? ''}
              className="input-field"
            />
          </div>
        </div>

        <div>
          <span className="label-field">Роли в случаях</span>
          <div className="mt-2 flex flex-wrap gap-3">
            {ROLE_OPTIONS.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={roles.includes(value)} onChange={() => toggleRole(value)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Сохранение…' : 'Сохранить изменения'}
        </button>
      </form>
    </div>
  );
}
