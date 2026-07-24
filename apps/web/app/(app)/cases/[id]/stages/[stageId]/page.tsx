'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { CompletenessSummary } from '@/components/CompletenessSummary';
import { JawRelationBanner } from '@/components/JawRelationBanner';
import { MediaViewer } from '@/components/MediaViewer';
import { PageHeader } from '@/components/PageHeader';
import { StageTabs } from '@/components/StageTabs';
import { ErrorState, LoadingState } from '@/components/States';
import { mediaApi, stagesApi, type MediaAssetDto, type StageDetailDto } from '@/lib/api';
import { STAGE_STATUS_LABELS } from '@/lib/constants';

function assetTitle(asset: MediaAssetDto) {
  let name = asset.displayName ?? asset.positionName ?? null;
  if (!name) {
    name =
      asset.assignments?.find((a) => a.status !== 'REJECTED')?.requirementInstance?.mediaRequirement
        ?.name ?? null;
  }
  if (!name) {
    name =
      asset.assignments?.find((a) => a.status !== 'REJECTED')?.requirementCode ??
      asset.originalFileName ??
      asset.originalFilename ??
      'Файл без названия';
  }
  return asset.sortOrder != null ? `${asset.sortOrder}. ${name}` : name;
}

function mediaTypeLabel(mediaType: string) {
  switch (mediaType) {
    case 'PHOTO':
      return 'Фото';
    case 'VIDEO':
      return 'Видео';
    case 'DOCUMENT':
      return 'Документ';
    case 'STL':
      return 'STL';
    case 'RADIOLOGY_IMAGE':
      return 'Рентген';
    default:
      return mediaType;
  }
}

export default function StageDetailPage() {
  const { id: caseId, stageId } = useParams<{ id: string; stageId: string }>();
  const [stage, setStage] = useState<StageDetailDto | null>(null);
  const [completeness, setCompleteness] = useState<Awaited<
    ReturnType<typeof stagesApi.completeness>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [busyMedia, setBusyMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ assets: MediaAssetDto[]; index: number; label: string } | null>(
    null,
  );

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

  const assets = useMemo(() => {
    const list = stage?.mediaAssets ?? [];
    return [...list].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  }, [stage?.mediaAssets]);

  function openViewer(asset: MediaAssetDto) {
    const sameType = assets.filter((a) => a.mediaType === asset.mediaType);
    const index = Math.max(0, sameType.findIndex((a) => a.id === asset.id));
    setViewer({
      assets: sameType,
      index,
      label: `${mediaTypeLabel(asset.mediaType)} этапа`,
    });
  }

  function canDeleteAsset(asset: MediaAssetDto) {
    const code = asset.requirementCode;
    const riId = asset.assignments?.find((a) => a.status !== 'REJECTED')?.requirementInstanceId;
    const siblings = assets.filter((a) => {
      if (a.id === asset.id) return false;
      return (a.assignments ?? []).some(
        (asg) =>
          asg.status !== 'REJECTED' &&
          ((riId && asg.requirementInstanceId === riId) ||
            (code && asg.requirementCode === code)),
      );
    });
    const req = stage?.requirementInstances?.find(
      (r) => r.id === riId || r.mediaRequirement.code === code,
    )?.mediaRequirement;
    const needed = req
      ? Math.max(req.minCount || 0, req.required ? 1 : 0)
      : 0;
    return siblings.length >= needed;
  }

  async function handleDelete(asset: MediaAssetDto) {
    if (!canDeleteAsset(asset)) {
      setError(
        `Нельзя удалить «${assetTitle(asset)}»: это обязательный минимум для положения. Загрузите замену или оставьте файл.`,
      );
      return;
    }
    if (!window.confirm(`Удалить файл «${assetTitle(asset)}»?`)) return;
    setBusyMedia(true);
    setError(null);
    setMessage(null);
    try {
      await mediaApi.archive(asset.id);
      setMessage(`Файл удалён: ${assetTitle(asset)}`);
      if (viewer) setViewer(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить файл');
    } finally {
      setBusyMedia(false);
    }
  }

  async function handleCleanupDuplicates() {
    if (
      !window.confirm(
        'Удалить лишние (задвоенные) файлы? По каждому положению останется только обязательное количество.',
      )
    ) {
      return;
    }
    setBusyMedia(true);
    setError(null);
    setMessage(null);
    try {
      const result = await mediaApi.cleanupDuplicates(stageId);
      setMessage(result.message);
      if (viewer) setViewer(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось очистить дубликаты');
    } finally {
      setBusyMedia(false);
    }
  }

  const needsDoctorConfirm =
    completeness?.blockingReasons?.some((r) =>
      r.toLowerCase().includes('подтверждение врача'),
    ) ?? false;

  async function handleConfirmDoctor() {
    setConfirming(true);
    setError(null);
    setMessage(null);
    try {
      await stagesApi.confirmDoctor(stageId);
      setMessage('Подтверждение врача сохранено');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подтвердить этап');
    } finally {
      setConfirming(false);
    }
  }

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

      <StageTabs active="checklist" stageCode={stage.stageTemplate.code} />

      {error ? <div className="alert-error mb-4 mt-4">{error}</div> : null}
      {message ? <div className="mb-4 mt-4 text-sm text-status-success">{message}</div> : null}

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
              <Link
                href={`/cases/${caseId}/stages/${stageId}/surgical-radiology`}
                className="btn-primary"
              >
                Рентгенология
              </Link>
            ) : (
              <button
                type="button"
                className="btn-primary"
                disabled={confirming || !needsDoctorConfirm}
                onClick={() => void handleConfirmDoctor()}
                title={
                  needsDoctorConfirm
                    ? 'Зафиксировать подтверждение ответственного врача'
                    : 'Подтверждение врача уже есть'
                }
              >
                {confirming
                  ? 'Подтверждение…'
                  : needsDoctorConfirm
                    ? 'Подтвердить этап врачом'
                    : 'Этап подтверждён врачом'}
              </button>
            )}
          </div>
          {needsDoctorConfirm && stage.stageTemplate.code !== 'POSTOP_SURGICAL_RADIOLOGY_CONTROL' ? (
            <p className="mt-3 text-xs text-gray-500">
              После загрузки и проверки материалов нажмите «Подтвердить этап врачом». Без этого
              закрытие этапа будет заблокировано.
            </p>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Медиаматериалы</h2>
          {assets.length > 0 ? (
            <button
              type="button"
              className="btn-secondary !px-3 !py-1 text-xs"
              disabled={busyMedia}
              onClick={() => void handleCleanupDuplicates()}
            >
              Удалить дубликаты
            </button>
          ) : null}
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Можно удалить лишние файлы. Обязательный минимум по каждому положению протокола сохраняется.
        </p>
        {assets.length ? (
          <ul className="space-y-1 text-sm">
            {assets.map((asset) => {
              const title = assetTitle(asset);
              const deletable = canDeleteAsset(asset);
              return (
                <li key={asset.id} className="flex items-center justify-between gap-3 border-b border-border py-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left text-accent underline-offset-2 hover:underline"
                    onClick={() => openViewer(asset)}
                  >
                    <span className="font-medium">{title}</span>
                    <span className="mt-0.5 block truncate text-xs text-gray-500">
                      {mediaTypeLabel(asset.mediaType)}
                      {asset.requirementCode ? ` · ${asset.requirementCode}` : ''}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="badge-muted">{asset.status}</span>
                    <button
                      type="button"
                      className="btn-secondary !px-2 !py-1 text-xs"
                      disabled={busyMedia || !deletable}
                      title={
                        deletable
                          ? 'Удалить файл'
                          : 'Нельзя удалить: обязательный минимум для положения'
                      }
                      onClick={() => void handleDelete(asset)}
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Материалы ещё не загружены.</p>
        )}
      </div>

      {viewer ? (
        <MediaViewer
          assets={viewer.assets}
          initialIndex={viewer.index}
          setLabel={viewer.label}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  );
}
