'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { StageTabs } from '@/components/StageTabs';
import { ErrorState, LoadingState } from '@/components/States';
import {
  radiologyApi,
  type RadiologyStudyDto,
  type SurgicalImplantDto,
  type SurgeonConfirmationDto,
} from '@/lib/api';

function attachmentsOf(implant: SurgicalImplantDto) {
  return implant.radiologyAttachments ?? implant.attachments ?? [];
}

export default function SurgicalRadiologyPage() {
  const { id: caseId, stageId } = useParams<{ id: string; stageId: string }>();
  const [studies, setStudies] = useState<RadiologyStudyDto[]>([]);
  const [implants, setImplants] = useState<SurgicalImplantDto[]>([]);
  const [confirmation, setConfirmation] = useState<SurgeonConfirmationDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [studiesData, implantsData, confirmationData] = await Promise.all([
        radiologyApi.studies(stageId),
        radiologyApi.implants(stageId),
        radiologyApi.surgeonConfirmation(stageId),
      ]);
      setStudies(studiesData);
      setImplants(implantsData);
      setConfirmation(confirmationData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [stageId]);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const hasOptg = studies.some((s) => s.studyType === 'OPTG');
      const allMethods = implants.every((i) => i.actualMethodCode);
      const allSlices = implants.every((i) =>
        attachmentsOf(i).some((a) => a.surgeonConfirmed),
      );
      const allFields = implants.every(
        (i) =>
          (i.jawScope === 'UPPER' || i.jawScope === 'LOWER') &&
          i.toothPositionFdi &&
          i.implantTypeId &&
          i.actualMethodCode,
      );

      await radiologyApi.confirmSurgeon(stageId, {
        comment,
        allImplantsDocumented: implants.length > 0 && allFields,
        optgUploaded: hasOptg,
        cbctUploaded: true,
        allImplantsHaveCtSlices: allSlices,
        allImplantsHaveMethodSelected: allMethods,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка подтверждения');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && !studies.length && !implants.length) {
    return <ErrorState message={error} onRetry={load} />;
  }

  const hasOptg = studies.some((s) => s.studyType === 'OPTG');
  const cardsReady = implants.filter((i) => {
    const slices = attachmentsOf(i);
    return (
      (i.jawScope === 'UPPER' || i.jawScope === 'LOWER') &&
      i.toothPositionFdi &&
      i.implantTypeId &&
      i.actualMethodCode &&
      slices.some((a) => a.surgeonConfirmed)
    );
  }).length;

  return (
    <div>
      <PageHeader
        title="Отчёт по рентгенологии"
        description="Сводка загруженных материалов и подтверждение хирурга"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/cases/${caseId}/stages/${stageId}/upload?tab=radiology`}
              className="btn-secondary"
            >
              К загрузке материалов
            </Link>
            <Link href={`/cases/${caseId}/stages/${stageId}`} className="btn-secondary">
              К этапу
            </Link>
          </div>
        }
      />

      <StageTabs active="report" stageCode="POSTOP_SURGICAL_RADIOLOGY_CONTROL" />

      {error ? <div className="alert-error mb-4">{error}</div> : null}

      <div className="space-y-4">
        <section className="card">
          <h2 className="mb-2 font-semibold text-graphite">Сводка комплекта</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>ОПТГ: {hasOptg ? 'загружено' : 'не загружено'}</li>
            <li>
              Карточки срезов: {cardsReady} / {implants.length || 0} готовы
              {!implants.length ? ' (карточек пока нет)' : ''}
            </li>
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            ОПТГ и карточки срезов заполняются в разделе загрузки материалов → «Рентгенология».
          </p>
        </section>

        <section className="card">
          <h2 className="mb-2 font-semibold text-graphite">Реестр имплантатов</h2>
          {implants.length ? (
            <ul className="divide-y divide-border rounded border border-border text-sm">
              {implants.map((i) => {
                const slices = attachmentsOf(i);
                const ok =
                  Boolean(i.toothPositionFdi && i.implantTypeId && i.actualMethodCode) &&
                  slices.some((a) => a.surgeonConfirmed);
                return (
                  <li key={i.id} className="px-3 py-2">
                    <div className="font-medium">
                      #{i.implantNumber} · {i.implantLabel || `Зуб ${i.toothPositionFdi ?? '—'}`}
                      <span className={`ml-2 text-xs ${ok ? 'text-status-success' : 'text-status-warning'}`}>
                        {ok ? 'готово' : 'неполно'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {i.jawScope === 'UPPER'
                        ? 'Верхняя'
                        : i.jawScope === 'LOWER'
                          ? 'Нижняя'
                          : i.jawScope}
                      {i.toothPositionFdi ? ` · зуб ${i.toothPositionFdi}` : ''}
                      {i.implantType ? ` · ${i.implantType.nameRu}` : ''}
                      {i.actualMethodCode ? ` · ${i.actualMethodCode}` : ''}
                      {slices.some((a) => a.surgeonConfirmed) ? ' · JPG есть' : ' · JPG нет'}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Реестр пуст — добавьте карточки в загрузке материалов.</p>
          )}
        </section>

        <section className="card">
          <h2 className="mb-2 font-semibold text-graphite">Подтверждение хирурга</h2>
          {confirmation ? (
            <p className="text-sm text-status-success">
              Подтверждено {new Date(confirmation.confirmedAt).toLocaleString('ru-RU')}
            </p>
          ) : (
            <>
              <label className="label-field" htmlFor="comment">
                Комментарий хирурга
              </label>
              <textarea
                id="comment"
                className="input-field mb-3 min-h-[80px]"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void handleConfirm()}
              >
                Подтвердить рентгенологический комплект
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
