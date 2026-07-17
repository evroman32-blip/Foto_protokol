'use client';

import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { adminApi } from '@/lib/api';

export default function YandexAiPage() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void adminApi.yandexAi().then(setConfig).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Yandex AI" description="Mock по умолчанию · x-data-logging-enabled: false" />
      <div className="card">
        <pre className="overflow-x-auto text-sm">{JSON.stringify(config, null, 2)}</pre>
      </div>
    </div>
  );
}
