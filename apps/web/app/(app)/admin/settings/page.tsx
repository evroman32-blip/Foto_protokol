'use client';

import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { adminApi } from '@/lib/api';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void adminApi.settings().then(setSettings).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Настройки системы" description="Конфигурация окружения (read-only)" />
      <div className="card">
        <pre className="overflow-x-auto text-sm text-graphite">{JSON.stringify(settings, null, 2)}</pre>
      </div>
    </div>
  );
}
