'use client';

import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { managementApi, type IntegrationEventsResponse, type IntegrationEventDto } from '@/lib/api';

export default function IntegrationEventsPage() {
  const [data, setData] = useState<IntegrationEventsResponse>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void managementApi
      .integrationEvents()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  const events: IntegrationEventDto[] = Array.isArray(data)
    ? data
    : data.events ?? [];
  const disabled = !Array.isArray(data) && data.enabled === false;

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
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{e.eventType}</td>
                  <td>{e.status ?? '—'}</td>
                  <td>{new Date(e.createdAt).toLocaleString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
