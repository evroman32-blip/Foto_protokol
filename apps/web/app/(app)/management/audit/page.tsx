'use client';

import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { managementApi, type AuditEventDto } from '@/lib/api';

export default function ManagementAuditPage() {
  const [events, setEvents] = useState<AuditEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void managementApi
      .audit()
      .then(setEvents)
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  return (
    <div>
      <PageHeader title="Журнал аудита" description="GET /api/v1/audit" />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Время</th>
              <th>Событие</th>
              <th>Актор</th>
              <th>Случай / этап</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.createdAt).toLocaleString('ru-RU')}</td>
                <td>{e.eventType}</td>
                <td>{e.actorName ?? e.actorEmail ?? e.actorUserId ?? '—'}</td>
                <td className="text-xs">{e.clinicalCaseId ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
