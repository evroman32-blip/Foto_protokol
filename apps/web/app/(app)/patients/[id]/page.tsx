'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { patientsApi, type PatientDto } from '@/lib/api';
import { confirmDelete } from '@/lib/confirm-delete';
import { formatPatientLabel, patientCardNumber } from '@/lib/patient-label';
import { useCurrentUser } from '@/lib/use-current-user';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isSiteAdmin, canEditPatients, isExpert } = useCurrentUser();
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
    if (!patient || !canEditPatients) return;
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await patientsApi.update(id, {
        lastName: String(fd.get('lastName')),
        firstName: String(fd.get('firstName')),
        middleName: String(fd.get('middleName') || '') || undefined,
        birthDate: String(fd.get('birthDate') || '') || undefined,
        sex: String(fd.get('sex')),
        phone: String(fd.get('phone') || '') || undefined,
        cardNumber: String(fd.get('cardNumber') || '') || undefined,
      });
      router.push('/patients');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !(await confirmDelete(
        'Удалить карточку пациента? Если пациент участвует в клиническом случае, удаление будет запрещено.',
      ))
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
        title={formatPatientLabel(patient, { hideFio: isExpert })}
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
      {isExpert ? (
        <div className="card max-w-2xl">
          <div className="text-xs text-gray-500">Номер карты</div>
          <div className="text-lg font-medium">{patientCardNumber(patient) || '—'}</div>
        </div>
      ) : (
        <>
      {!canEditPatients ? (
        <p className="mb-4 text-sm text-gray-600">
          Изменять карточку пациента могут все врачи, а также исполнительный директор,
          управляющий клиникой, администратор клиники, главный врач и модератор.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="card max-w-2xl space-y-4">
        <fieldset disabled={!canEditPatients} className="space-y-4 border-0 p-0">
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

        {canEditPatients ? (
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Сохранение…' : 'Сохранить изменения'}
          </button>
        ) : null}
        </fieldset>
      </form>
        </>
      )}
    </div>
  );
}
