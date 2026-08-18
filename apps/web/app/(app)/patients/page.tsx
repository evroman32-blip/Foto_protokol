'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { patientsApi, type PatientDto } from '@/lib/api';
import { confirmDelete } from '@/lib/confirm-delete';
import { formatPatientLabel } from '@/lib/patient-label';
import { compareFioRu } from '@/lib/sort-fio';
import { useCurrentUser } from '@/lib/use-current-user';

export default function PatientsPage() {
  const { isSiteAdmin, canEditPatients, isExpert } = useCurrentUser();
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
      setPatients(isExpert ? rows : [...rows].sort(compareFioRu));
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
      !(await confirmDelete(
        'Удалить карточку пациента? Если пациент участвует в клиническом случае, удаление будет запрещено.',
      ))
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
          canEditPatients ? (
            <Link href="/patients/new" className="btn-primary">
              Добавить пациента
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex gap-2">
        <input
          className="input-field max-w-md"
          placeholder={isExpert ? 'Поиск по номеру карты…' : 'Поиск по ФИО, телефону, карте…'}
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
                {isExpert ? <th>Номер карты</th> : <th>ФИО</th>}
                {isExpert ? null : <th>Дата рождения</th>}
                {isExpert ? null : <th>Телефон</th>}
                {isExpert ? null : <th>Карта</th>}
                {isSiteAdmin ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">
                    <Link href={`/patients/${p.id}`}>
                      {formatPatientLabel(p, { hideFio: isExpert })}
                    </Link>
                  </td>
                  {isExpert ? null : (
                    <td>{p.birthDate ? new Date(p.birthDate).toLocaleDateString('ru-RU') : '—'}</td>
                  )}
                  {isExpert ? null : <td>{p.phone ?? '—'}</td>}
                  {isExpert ? null : <td>{p.cardNumber ?? '—'}</td>}
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
