'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { patientsApi, type PatientDto } from '@/lib/api';
import { useCurrentUser } from '@/lib/use-current-user';

function formatPatient(p: PatientDto) {
  return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ');
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isSiteAdmin } = useCurrentUser();
  const [patient, setPatient] = useState<PatientDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setPatient(await patientsApi.get(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!patient) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    try {
      const updated = await patientsApi.update(id, {
        lastName: String(fd.get('lastName')),
        firstName: String(fd.get('firstName')),
        middleName: String(fd.get('middleName') || '') || undefined,
        birthDate: String(fd.get('birthDate') || '') || undefined,
        sex: String(fd.get('sex')),
        phone: String(fd.get('phone') || '') || undefined,
        cardNumber: String(fd.get('cardNumber') || '') || undefined,
      });
      setPatient(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        'Удалить карточку пациента? Если пациент участвует в клиническом случае, удаление будет запрещено.',
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await patientsApi.remove(id);
      router.push('/patients');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить карточку');
      setDeleting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && !patient) return <ErrorState message={error} onRetry={load} />;
  if (!patient) return null;

  return (
    <div>
      <PageHeader
        title={formatPatient(patient)}
        actions={
          <div className="flex gap-2">
            <Link href="/patients" className="btn-secondary">
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

      <form onSubmit={handleSubmit} className="card max-w-2xl space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label-field" htmlFor="lastName">
              Фамилия
            </label>
            <input
              id="lastName"
              name="lastName"
              defaultValue={patient.lastName}
              required
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
              defaultValue={patient.firstName}
              required
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
              defaultValue={patient.middleName ?? ''}
              className="input-field"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label-field" htmlFor="birthDate">
              Дата рождения
            </label>
            <input
              id="birthDate"
              name="birthDate"
              type="date"
              defaultValue={patient.birthDate?.slice(0, 10) ?? ''}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field" htmlFor="sex">
              Пол
            </label>
            <select id="sex" name="sex" defaultValue={patient.sex ?? 'UNSPECIFIED'} className="input-field">
              <option value="UNSPECIFIED">Не указан</option>
              <option value="MALE">Мужской</option>
              <option value="FEMALE">Женский</option>
            </select>
          </div>
          <div>
            <label className="label-field" htmlFor="phone">
              Телефон
            </label>
            <input id="phone" name="phone" defaultValue={patient.phone ?? ''} className="input-field" />
          </div>
        </div>

        <div>
          <label className="label-field" htmlFor="cardNumber">
            Номер карты
          </label>
          <input
            id="cardNumber"
            name="cardNumber"
            defaultValue={patient.cardNumber ?? ''}
            className="input-field"
          />
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Сохранение…' : 'Сохранить изменения'}
        </button>
      </form>
    </div>
  );
}
