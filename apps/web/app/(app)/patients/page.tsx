'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { patientsApi, type PatientDto } from '@/lib/api';

function formatPatient(p: PatientDto) {
  return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ');
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientDto[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(search?: string) {
    setLoading(true);
    setError(null);
    try {
      setPatients(await patientsApi.list(search ? { q: search } : undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Пациенты"
        description="Локальный реестр пациентов (связь с 1С необязательна)"
        actions={
          <Link href="/patients/new" className="btn-primary">
            Добавить пациента
          </Link>
        }
      />

      <div className="mb-4 flex gap-2">
        <input
          className="input-field max-w-md"
          placeholder="Поиск по ФИО, телефону, карте…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load(q)}
        />
        <button type="button" className="btn-secondary" onClick={() => void load(q)}>
          Найти
        </button>
      </div>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} onRetry={() => load(q)} /> : null}

      {!loading && !error && patients.length === 0 ? (
        <EmptyState message="Пациенты не найдены" />
      ) : null}

      {!loading && !error && patients.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Дата рождения</th>
                <th>Телефон</th>
                <th>Карта</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{formatPatient(p)}</td>
                  <td>{p.birthDate ? new Date(p.birthDate).toLocaleDateString('ru-RU') : '—'}</td>
                  <td>{p.phone ?? '—'}</td>
                  <td>{p.cardNumber ?? '—'}</td>
                  <td>
                    <Link href={`/patients/${p.id}`} className="text-sm">
                      Открыть
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
