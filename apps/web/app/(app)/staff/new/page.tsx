'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { staffApi } from '@/lib/api';

const ROLE_OPTIONS = [
  { value: 'CONSULTING_DOCTOR', label: 'Консультирующий врач' },
  { value: 'ORTHOPEDIST', label: 'Ортопед' },
  { value: 'SURGEON', label: 'Хирург' },
  { value: 'DENTAL_TECHNICIAN', label: 'Зубной техник' },
];

export default function NewStaffPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);

  function toggleRole(role: string) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const member = await staffApi.create({
        lastName: String(fd.get('lastName')),
        firstName: String(fd.get('firstName')),
        middleName: String(fd.get('middleName') || '') || undefined,
        position: String(fd.get('position') || '') || undefined,
        specialization: String(fd.get('specialization') || '') || undefined,
        roles,
      });
      router.push(`/staff/${member.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
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
              Должность
            </label>
            <input id="position" name="position" className="input-field" />
          </div>
          <div>
            <label className="label-field" htmlFor="specialization">
              Специализация
            </label>
            <input id="specialization" name="specialization" className="input-field" />
          </div>
        </div>

        <div>
          <span className="label-field">Роли в случаях</span>
          <div className="mt-2 flex flex-wrap gap-3">
            {ROLE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={roles.includes(opt.value)}
                  onChange={() => toggleRole(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
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
