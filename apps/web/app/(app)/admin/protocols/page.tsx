'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { adminApi, type ProtocolVersionDto } from '@/lib/api';

export default function AdminProtocolsPage() {
  const [versions, setVersions] = useState<ProtocolVersionDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void adminApi.protocolVersions().then(setVersions).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Протоколы" description="Strategic Implant PhotoProtocol" />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Протокол</th>
              <th>Версия</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td>{v.protocolName ?? v.protocolId}</td>
                <td>{v.version}</td>
                <td>
                  <span className="badge-muted">{v.status}</span>
                </td>
                <td>
                  <Link
                    href={`/admin/protocols/${v.protocolId}/versions/${v.id}`}
                    className="text-sm text-accent"
                  >
                    Шаблоны
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
