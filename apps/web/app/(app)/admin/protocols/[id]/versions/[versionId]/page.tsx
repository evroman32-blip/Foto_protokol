'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { adminApi } from '@/lib/api';

interface StageTemplateRow {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  ownerRole: string;
  dependsOnStageCode?: string | null;
}

export default function ProtocolVersionPage() {
  const { id: protocolId, versionId } = useParams<{ id: string; versionId: string }>();
  const [templates, setTemplates] = useState<StageTemplateRow[]>([]);
  const [versionLabel, setVersionLabel] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void adminApi
      .protocolVersion(protocolId, versionId)
      .then((v) => {
        setVersionLabel(v.version);
        setTemplates((v as { stageTemplates?: StageTemplateRow[] }).stageTemplates ?? []);
      })
      .finally(() => setLoading(false));
  }, [protocolId, versionId]);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title={`Версия протокола ${versionLabel}`} description="11 этапов промышленного маршрута" />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Код</th>
              <th>Название</th>
              <th>Owner</th>
              <th>Зависимость</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>{t.sortOrder}</td>
                <td className="font-mono text-xs">{t.code}</td>
                <td>{t.name}</td>
                <td>{t.ownerRole}</td>
                <td>{t.dependsOnStageCode ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
