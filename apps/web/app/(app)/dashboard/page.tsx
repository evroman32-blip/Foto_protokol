'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { casesApi, type ClinicalCaseDto } from '@/lib/api';
import { CASE_STATUS_LABELS, JAW_SCOPE_LABELS } from '@/lib/constants';

function patientName(p: ClinicalCaseDto['patient']) {
  return [p.lastName, p.firstName, p.middleName].filter(Boolean).join(' ');
}

function CaseRow({ c }: { c: ClinicalCaseDto }) {
  const stages = c.stageInstances ?? [];
  const warnings = stages.flatMap((s) => s.completeness?.warnings ?? []);
  const blockers = stages.flatMap((s) => s.completeness?.blockingReasons ?? []);
  const hasIssues = warnings.length > 0 || blockers.length > 0;

  return (
    <tr>
      <td>
        <Link href={`/cases/${c.id}`} className="font-medium">
          {patientName(c.patient)}
        </Link>
        <div className="text-xs text-gray-500">{c.clinicalScenario}</div>
      </td>
      <td>{JAW_SCOPE_LABELS[c.jawScope] ?? c.jawScope}</td>
      <td>
        <span className="badge-muted">{CASE_STATUS_LABELS[c.status] ?? c.status}</span>
      </td>
      <td>{new Date(c.treatmentStartDate).toLocaleDateString('ru-RU')}</td>
      <td>
        {hasIssues ? (
          <div className="space-y-1">
            {blockers.slice(0, 2).map((r) => (
              <div key={r} className="text-xs text-status-error">
                {r}
              </div>
            ))}
            {warnings.slice(0, 1).map((w) => (
              <div key={w} className="text-xs text-status-warning">
                {w}
              </div>
            ))}
            {(blockers.length > 2 || warnings.length > 1) && (
              <div className="text-xs text-gray-500">…ещё предупреждения</div>
            )}
          </div>
        ) : (
          <span className="text-xs text-status-success">Комплектность в норме</span>
        )}
      </td>
      <td>
        <Link href={`/cases/${c.id}`} className="text-sm">
          Открыть
        </Link>
      </td>
    </tr>
  );
}

export default function DashboardPage() {
  const [cases, setCases] = useState<ClinicalCaseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setCases(await casesApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить случаи');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Панель управления"
        description="Клинические случаи и предупреждения по комплектности этапов"
        actions={
          <Link href="/cases/new" className="btn-primary">
            Новый случай
          </Link>
        }
      />

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {!loading && !error && cases.length === 0 ? (
        <EmptyState
          message="Клинических случаев пока нет"
          action={
            <Link href="/cases/new" className="btn-primary">
              Создать первый случай
            </Link>
          }
        />
      ) : null}

      {!loading && !error && cases.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Пациент / сценарий</th>
                <th>Челюсть</th>
                <th>Статус</th>
                <th>Начало лечения</th>
                <th>Комплектность</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <CaseRow key={c.id} c={c} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
