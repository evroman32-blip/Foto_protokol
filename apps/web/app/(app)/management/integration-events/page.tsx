'use client';

import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { managementApi } from '@/lib/api';

export default function IntegrationEventsPage() {
  const [data, setData] = useState<{ enabled?: boolean; events?: unknown[] } | unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void managementApi
      .integrationEvents()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  const events = Array.isArray(data) ? data : (data as { events?: unknown[] }).events ?? [];
  const disabled = !Array.isArray(data) && (data as { enabled?: boolean }).enabled === false;

  return (
    <div>
      <PageHeader title="События интеграции" description="STOMA1C_INTEGRATION_ENABLED" />
      {disabled ? (
        <div className="card text-sm text-gray-600">Интеграция с 1С отключена (standalone mode).</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Тип</th>
                <th>Статус</th>
                <th>Создано</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const row = e as Record<string, unknown>;
                return (
                  <tr key={String(row.id)}>
                    <td>{String(row.eventType ?? '—')}</td>
                    <td>{String(row.status ?? '—')}</td>
                    <td>{row.createdAt ? new Date(String(row.createdAt)).toLocaleString('ru-RU') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
