'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { staffApi, type StaffDto } from '@/lib/api';
import { PARTICIPANT_ROLE_LABELS } from '@/lib/constants';

function formatStaff(s: StaffDto) {
  return [s.lastName, s.firstName, s.middleName].filter(Boolean).join(' ');
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(search?: string) {
    setLoading(true);
    setError(null);
    try {
      setStaff(await staffApi.list(search ? { q: search } : undefined));
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
        title="Сотрудники"
        description="Участники клинических случаев"
        actions={
          <Link href="/staff/new" className="btn-primary">
            Добавить сотрудника
          </Link>
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
                <th />
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{formatStaff(s)}</td>
                  <td>{s.position ?? '—'}</td>
                  <td>{s.specialization ?? '—'}</td>
                  <td>
                    {(s.roles ?? [])
                      .map((r) => PARTICIPANT_ROLE_LABELS[r] ?? r)
                      .join(', ') || '—'}
                  </td>
                  <td>
                    <Link href={`/staff/${s.id}`} className="text-sm">
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
