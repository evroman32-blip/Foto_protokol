'use client';

import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { managementApi, type EmergencyEventDto } from '@/lib/api';

export default function EmergencyEventsPage() {
  const [events, setEvents] = useState<EmergencyEventDto[]>([]);
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
              <tr key={e.id}>
                <td>{e.occurredAt ? new Date(e.occurredAt).toLocaleString('ru-RU') : '—'}</td>
                <td>{e.reason || '—'}</td>
                <td>{e.clinicalSituation || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
