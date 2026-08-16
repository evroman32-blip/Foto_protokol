'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { staffApi, type StaffDto } from '@/lib/api';
import { STAFF_CLINICAL_ROLE_LABELS } from '@/lib/constants';
import { compareFioRu } from '@/lib/sort-fio';
import { useCurrentUser } from '@/lib/use-current-user';

function formatStaff(s: StaffDto) {
  return [s.lastName, s.firstName, s.middleName].filter(Boolean).join(' ');
}

export default function StaffPage() {
  const { canEditStaff, isSiteAdmin } = useCurrentUser();
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load(search?: string) {
    setLoading(true);
    setError(null);
    try {
      const rows = await staffApi.list(search ? { q: search } : undefined);
      setStaff([...rows].sort(compareFioRu));
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
        'Удалить карточку сотрудника? Если сотрудник участвует в клиническом случае, удаление будет запрещено.',
      )
    ) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      await staffApi.remove(id);
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
        title="Сотрудники"
        description="Участники клинических случаев"
        actions={
          canEditStaff ? (
            <Link href="/staff/new" className="btn-primary">
              Добавить сотрудника
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex gap-2">
        <input
          className="input-field max-w-md"
          placeholder="Поиск по ФИО, должности…"
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

      {!loading && !error && staff.length === 0 ? <EmptyState message="Сотрудники не найдены" /> : null}

      {!loading && !error && staff.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Должность</th>
                <th>Специализация</th>
                <th>Роли</th>
                {isSiteAdmin ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">
                    <Link href={`/staff/${s.id}`}>{formatStaff(s)}</Link>
                  </td>
                  <td>{s.position ?? '—'}</td>
                  <td>{s.specialization ?? '—'}</td>
                  <td>
                    {(s.clinicalRoles ?? s.roles ?? [])
                      .map((r) => STAFF_CLINICAL_ROLE_LABELS[r as keyof typeof STAFF_CLINICAL_ROLE_LABELS] ?? r)
                      .join(', ') || '—'}
                  </td>
                  {isSiteAdmin ? (
                    <td>
                      <button
                        type="button"
                        className="btn-danger !px-3 !py-1 text-xs"
                        disabled={deletingId === s.id}
                        onClick={() => void handleDelete(s.id)}
                      >
                        {deletingId === s.id ? 'Удаление…' : 'Удалить'}
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
