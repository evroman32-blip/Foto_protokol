'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CompletenessSummary } from '@/components/CompletenessSummary';
import { PageHeader } from '@/components/PageHeader';
import { StageTabs } from '@/components/StageTabs';
import { ErrorState, LoadingState } from '@/components/States';
import { stagesApi } from '@/lib/api';

export default function StageReportPage() {
  const { id: caseId, stageId } = useParams<{ id: string; stageId: string }>();
  const [completeness, setCompleteness] = useState<Awaited<ReturnType<typeof stagesApi.completeness>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeResult, setCloseResult] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setCompleteness(await stagesApi.completeness(stageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [stageId]);

  async function handleClose() {
    setClosing(true);
    setCloseResult(null);
    try {
      await stagesApi.close(stageId);
      setCloseResult('Этап успешно закрыт');
      await load();
    } catch (err) {
      setCloseResult(err instanceof Error ? err.message : 'Не удалось закрыть этап');
    } finally {
      setClosing(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Отчёт этапа"
        description="Комплектность и закрытие этапа (только backend)"
        actions={
          <Link href={`/cases/${caseId}/stages/${stageId}`} className="btn-secondary">
            Назад
          </Link>
        }
      />

      <StageTabs active="main" />

      <div className="mb-6">
        <CompletenessSummary completeness={completeness} />
      </div>

      <div className="card max-w-lg">
        <h2 className="mb-3 text-base font-semibold">Закрытие этапа</h2>
        <p className="mb-4 text-sm text-gray-600">
          Закрытие возможно только при полной комплектности и подтверждении ответственного врача.
        </p>
        <button type="button" className="btn-primary" disabled={closing} onClick={() => void handleClose()}>
          {closing ? 'Обработка…' : 'Закрыть этап'}
        </button>
        {closeResult ? <p className="mt-3 text-sm text-graphite">{closeResult}</p> : null}
      </div>
    </div>
  );
}
