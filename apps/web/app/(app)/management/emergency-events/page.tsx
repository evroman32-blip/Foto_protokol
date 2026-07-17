'use client';

import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { managementApi } from '@/lib/api';

export default function EmergencyEventsPage() {
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void managementApi
      .emergencyEvents()
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Неотложные события" description="EmergencyEvent по этапам" />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Причина</th>
              <th>Клиническая ситуация</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={String(e.id)}>
                <td>{e.occurredAt ? new Date(String(e.occurredAt)).toLocaleString('ru-RU') : '—'}</td>
                <td>{String(e.reason ?? '—')}</td>
                <td>{String(e.clinicalSituation ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
