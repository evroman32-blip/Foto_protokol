'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AiSuggestions } from '@/components/AiSuggestions';
import { CompletenessSummary } from '@/components/CompletenessSummary';
import { PageHeader } from '@/components/PageHeader';
import { StageTabs } from '@/components/StageTabs';
import { ErrorState, LoadingState } from '@/components/States';
import { stagesApi, type StageDetailDto } from '@/lib/api';

export default function StageReviewPage() {
  const { id: caseId, stageId } = useParams<{ id: string; stageId: string }>();
  const [stage, setStage] = useState<StageDetailDto | null>(null);
  const [completeness, setCompleteness] = useState<Awaited<ReturnType<typeof stagesApi.completeness>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [stageData, completenessData] = await Promise.all([
        stagesApi.get(stageId),
        stagesApi.completeness(stageId),
      ]);
      setStage(stageData);
      setCompleteness(completenessData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [stageId]);

  if (loading) return <LoadingState />;
  if (error && !stage) return <ErrorState message={error} onRetry={load} />;
  if (!stage) return null;

  return (
    <div>
      <PageHeader
        title="Проверка и назначение"
        description="Подтверждение AI-предложений и контроль комплектности"
        actions={
          <Link href={`/cases/${caseId}/stages/${stageId}`} className="btn-secondary">
            Назад
          </Link>
        }
      />

      <StageTabs active="checklist" />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <CompletenessSummary completeness={completeness} />
        <AiSuggestions stageId={stageId} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-base font-semibold">Материалы этапа</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Файл</th>
                <th>Тип</th>
                <th>Статус</th>
                <th>Назначения</th>
              </tr>
            </thead>
            <tbody>
              {(stage.mediaAssets ?? []).map((asset) => (
                <tr key={asset.id}>
                  <td>{asset.originalFilename ?? asset.id}</td>
                  <td>{asset.mediaType}</td>
                  <td>
                    <span className="badge-muted">{asset.status}</span>
                  </td>
                  <td className="text-xs text-gray-600">
                    {(asset.assignments ?? [])
                      .map((a) => `${a.requirementCode ?? '—'} (${a.status})`)
                      .join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
