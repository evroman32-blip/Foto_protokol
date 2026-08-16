'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { patientsApi, type PatientDto } from '@/lib/api';
import { compareFioRu } from '@/lib/sort-fio';
import { useCurrentUser } from '@/lib/use-current-user';

function formatPatient(p: PatientDto) {
  return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ');
}

export default function PatientsPage() {
  const { isSiteAdmin } = useCurrentUser();
  const [patients, setPatients] = useState<PatientDto[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load(search?: string) {
    setLoading(true);
    setError(null);
    try {
      const rows = await patientsApi.list(search ? { q: search } : undefined);
      setPatients([...rows].sort(compareFioRu));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleDelete(id: string) {
    if (
      !confirm(
        'Удалить карточку пациента? Если пациент участвует в клиническом случае, удаление будет запрещено.',
      )
    ) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      await patientsApi.remove(id);
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить карточку');
    } finally {
      setDeletingId(null);
    }
  }

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
                {isSiteAdmin ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">
                    <Link href={`/patients/${p.id}`}>{formatPatient(p)}</Link>
                  </td>
                  <td>{p.birthDate ? new Date(p.birthDate).toLocaleDateString('ru-RU') : '—'}</td>
                  <td>{p.phone ?? '—'}</td>
                  <td>{p.cardNumber ?? '—'}</td>
                  {isSiteAdmin ? (
                    <td>
                      <button
                        type="button"
                        className="btn-danger !px-3 !py-1 text-xs"
                        disabled={deletingId === p.id}
                        onClick={() => void handleDelete(p.id)}
                      >
                        {deletingId === p.id ? 'Удаление…' : 'Удалить'}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
