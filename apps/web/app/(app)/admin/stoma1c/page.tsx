'use client';

import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { adminApi } from '@/lib/api';

export default function Stoma1cAdminPage() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void adminApi.stoma1c().then(setConfig).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  const enabled = config?.enabled === true;

  return (
    <div>
      <PageHeader title="1С:Стоматология" description="STOMA1C_INTEGRATION_ENABLED" />
      {!enabled ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Интеграция отключена. Standalone mode — отсутствие связи с 1С не блокирует закрытие этапа.
        </div>
      ) : null}
      <div className="card mt-4">
        <pre className="overflow-x-auto text-sm">{JSON.stringify(config, null, 2)}</pre>
      </div>
    </div>
  );
}
