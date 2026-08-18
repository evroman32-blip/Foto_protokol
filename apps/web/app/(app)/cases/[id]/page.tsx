'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { casesApi, type ClinicalCaseDto } from '@/lib/api';
import { confirmDelete } from '@/lib/confirm-delete';
import { CASE_STATUS_LABELS, JAW_SCOPE_LABELS, STAGE_STATUS_LABELS } from '@/lib/constants';
import { formatPatientLabel } from '@/lib/patient-label';
import { useCurrentUser } from '@/lib/use-current-user';

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isSiteAdmin, isExpert } = useCurrentUser();
  const [clinicalCase, setCase] = useState<ClinicalCaseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setCase(await casesApi.get(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function handleDelete() {
    if (
      !(await confirmDelete(
        'Удалить клинический случай? После удаления карточки пациента и сотрудников можно будет удалить, если они больше не участвуют в других случаях.',
      ))
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await casesApi.remove(id);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить случай');
      setDeleting(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && !clinicalCase) return <ErrorState message={error} onRetry={load} />;
  if (!clinicalCase) return null;

  const stages = [...(clinicalCase.stageInstances ?? [])].sort(
    (a, b) => a.stageTemplate.sortOrder - b.stageTemplate.sortOrder,
  );

  return (
    <div>
      <PageHeader
        title={formatPatientLabel(clinicalCase.patient, { hideFio: isExpert })}
        description={clinicalCase.clinicalScenario}
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard" className="btn-secondary">
              К панели
            </Link>
            {isSiteAdmin ? (
              <button type="button" className="btn-danger" disabled={deleting} onClick={() => void handleDelete()}>
                {deleting ? 'Удаление…' : 'Удалить случай'}
              </button>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card">
          <div className="text-xs text-gray-500">Статус</div>
          <div className="font-medium">{CASE_STATUS_LABELS[clinicalCase.status] ?? clinicalCase.status}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500">Челюсть</div>
          <div className="font-medium">{JAW_SCOPE_LABELS[clinicalCase.jawScope] ?? clinicalCase.jawScope}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500">Начало лечения</div>
          <div className="font-medium">
            {new Date(clinicalCase.treatmentStartDate).toLocaleDateString('ru-RU')}
          </div>
        </div>
      </div>

      <h2 className="mb-3">Этапы протокола</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Этап</th>
              <th>Статус</th>
              <th>Блокировки</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => {
              const blockers = s.completeness?.blockingReasons ?? [];
              return (
                <tr key={s.id}>
                  <td>{s.stageTemplate.sortOrder}</td>
                  <td>
                    <Link
                      href={`/cases/${id}/stages/${s.id}`}
                      className="font-medium text-graphite no-underline hover:text-accent hover:underline"
                    >
                      {s.stageTemplate.name}
                    </Link>
                  </td>
                  <td>
                    <span className="badge-muted">{STAGE_STATUS_LABELS[s.status] ?? s.status}</span>
                  </td>
                  <td>
                    {blockers.length > 0 ? (
                      <span className="text-xs text-status-error">{blockers[0]}</span>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
