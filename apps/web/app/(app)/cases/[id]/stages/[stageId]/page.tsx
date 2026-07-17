'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CompletenessSummary } from '@/components/CompletenessSummary';
import { JawRelationBanner } from '@/components/JawRelationBanner';
import { PageHeader } from '@/components/PageHeader';
import { StageTabs } from '@/components/StageTabs';
import { ErrorState, LoadingState } from '@/components/States';
import { stagesApi, type StageDetailDto } from '@/lib/api';
import { STAGE_STATUS_LABELS } from '@/lib/constants';

export default function StageDetailPage() {
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
      setError(err instanceof Error ? err.message : 'Ошибка загрузки этапа');
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
        title={stage.stageTemplate.name}
        description={`Этап ${stage.stageTemplate.sortOrder} · ${STAGE_STATUS_LABELS[stage.status] ?? stage.status}`}
        actions={
          <Link href={`/cases/${caseId}`} className="btn-secondary">
            К случаю
          </Link>
        }
      />

      <StageTabs active="main" />

      {stage.stageTemplate.code === 'JAW_RELATION' ? (
        <JawRelationBanner stageCode={stage.stageTemplate.code} completeness={completeness} />
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <CompletenessSummary completeness={completeness} />
        <div className="card">
          <h2 className="mb-3 text-base font-semibold">Действия</h2>
          <div className="flex flex-wrap gap-2">
            <Link href={`/cases/${caseId}/stages/${stageId}/upload`} className="btn-primary">
              Загрузить материалы
            </Link>
            <Link href={`/cases/${caseId}/stages/${stageId}/review`} className="btn-secondary">
              Проверка и назначение
            </Link>
            <Link href={`/cases/${caseId}/stages/${stageId}/report`} className="btn-secondary">
              Отчёт этапа
            </Link>
            {stage.stageTemplate.code === 'POSTOP_SURGICAL_RADIOLOGY_CONTROL' ? (
              <Link href={`/cases/${caseId}/stages/${stageId}/surgical-radiology`} className="btn-secondary">
                Рентгенология
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-base font-semibold">Медиаматериалы</h2>
        {stage.mediaAssets?.length ? (
          <ul className="space-y-2 text-sm">
            {stage.mediaAssets.map((asset) => (
              <li key={asset.id} className="flex justify-between border-b border-border py-2">
                <span>{asset.originalFilename ?? asset.id}</span>
                <span className="badge-muted">{asset.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Материалы ещё не загружены.</p>
        )}
      </div>
    </div>
  );
}
