'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { patientsApi } from '@/lib/api';
import { useCurrentUser } from '@/lib/use-current-user';

export default function NewPatientPage() {
  const router = useRouter();
  const { canEditPatients, loading: userLoading } = useCurrentUser();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEditPatients) return;
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const patient = await patientsApi.create({
        lastName: String(fd.get('lastName')),
        firstName: String(fd.get('firstName')),
        middleName: String(fd.get('middleName') || '') || undefined,
        birthDate: String(fd.get('birthDate') || '') || undefined,
        sex: String(fd.get('sex') || 'UNSPECIFIED'),
        phone: String(fd.get('phone') || '') || undefined,
        cardNumber: String(fd.get('cardNumber') || '') || undefined,
      });
      router.push(`/patients/${patient.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  }

  if (!userLoading && !canEditPatients) {
    return (
      <div>
        <PageHeader title="Новый пациент" />
        <div className="alert-error">
          Создавать карточку пациента могут все врачи, а также модератор, исполнительный
          директор, управляющий клиникой, администратор клиники и главный врач.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Новый пациент"
        actions={
          <Link href="/patients" className="btn-secondary">
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

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label-field" htmlFor="birthDate">
              Дата рождения
            </label>
            <input id="birthDate" name="birthDate" type="date" className="input-field" />
          </div>
          <div>
            <label className="label-field" htmlFor="sex">
              Пол
            </label>
            <select id="sex" name="sex" className="input-field">
              <option value="UNSPECIFIED">Не указан</option>
              <option value="MALE">Мужской</option>
              <option value="FEMALE">Женский</option>
            </select>
          </div>
          <div>
            <label className="label-field" htmlFor="phone">
              Телефон
            </label>
            <input id="phone" name="phone" type="tel" className="input-field" />
          </div>
        </div>

        <div>
          <label className="label-field" htmlFor="cardNumber">
            Номер карты *
          </label>
          <input id="cardNumber" name="cardNumber" required className="input-field" placeholder="Например LOCAL-0002" />
          <p className="mt-1 text-xs text-gray-500">Локальный номер карты пациента (обязателен без 1С)</p>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Сохранение…' : 'Сохранить'}
          </button>
          <Link href="/patients" className="btn-secondary">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  );
}
