'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { adminApi, type ProtocolVersionDto } from '@/lib/api';

export default function AdminProtocolsPage() {
  const [versions, setVersions] = useState<ProtocolVersionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void adminApi
      .protocolVersions()
      .then(setVersions)
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Протоколы"
        description="Настройка версий протокола, этапов и требований к материалам"
      />
      {error ? <div className="alert-error mb-4">{error}</div> : null}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Протокол</th>
              <th>Код</th>
              <th>Версия</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td className="font-medium">{v.protocolName ?? v.protocol?.name ?? 'Без названия'}</td>
                <td className="font-mono text-xs">{v.protocolCode ?? v.protocol?.code ?? '—'}</td>
                <td>{v.version}</td>
                <td>
                  <span className="badge-muted">{v.status}</span>
                </td>
                <td>
                  <Link
                    href={`/admin/protocols/${v.protocolId}/versions/${v.id}`}
                    className="text-sm text-accent"
                  >
                    Настроить шаблоны
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
