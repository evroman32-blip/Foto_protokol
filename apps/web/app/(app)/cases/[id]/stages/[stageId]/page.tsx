'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { CompletenessSummary } from '@/components/CompletenessSummary';
import { ImpressionCaptureModeToggle } from '@/components/ImpressionCaptureModeToggle';
import { JawRelationBanner } from '@/components/JawRelationBanner';
import { MediaBranchModeToggle } from '@/components/MediaBranchModeToggle';
import { MediaViewer } from '@/components/MediaViewer';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import {
  ApiError,
  mediaApi,
  radiologyApi,
  stagesApi,
  type MediaAssetDto,
  type StageDetailDto,
} from '@/lib/api';
import { confirmDelete } from '@/lib/confirm-delete';
import { STAGE_STATUS_LABELS } from '@/lib/constants';
import {
  MEDIA_BRANCH_LABELS,
  hasMixedMediaBranches,
  listMediaBranchTypes,
} from '@/lib/media-branch-mode';
import { useCurrentUser } from '@/lib/use-current-user';

function assetBaseName(asset: MediaAssetDto) {
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
  // Убрать префикс «3. » если он уже попал в название
  return name.replace(/^\d+\.\s*/, '');
}

/** Сквозная нумерация в списке этапа: 1, 2, 3, 4… */
function assetTitle(asset: MediaAssetDto, sequenceNo: number) {
  return `${sequenceNo}. ${assetBaseName(asset)}`;
}

export default function StageDetailPage() {
  const { id: caseId, stageId } = useParams<{ id: string; stageId: string }>();
  const [stage, setStage] = useState<StageDetailDto | null>(null);
  const [completeness, setCompleteness] = useState<Awaited<
    ReturnType<typeof stagesApi.completeness>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const { canEditClosedStage, isReadOnly, canCloseStage, canDelete } = useCurrentUser();
  const [modeBusy, setModeBusy] = useState(false);
  const [busyMedia, setBusyMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ assets: MediaAssetDto[]; index: number } | null>(
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
    const fdiOrder = [
      '18', '17', '16', '15', '14', '13', '12', '11',
      '28', '27', '26', '25', '24', '23', '22', '21',
      '38', '37', '36', '35', '34', '33', '32', '31',
      '48', '47', '46', '45', '44', '43', '42', '41',
    ];
    const toothRank = (a: MediaAssetDto) => {
      const tooth =
        a.toothPositionFdi ??
        (a.displayName?.match(/\b(\d{2})\b/)?.[1] ?? null);
      if (!tooth) return 999;
      const idx = fdiOrder.indexOf(tooth);
      return idx === -1 ? 999 : idx;
    };
    const list = stage?.mediaAssets ?? [];
    return [...list].sort((a, b) => {
      const so = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
      if (so !== 0) return so;
      return toothRank(a) - toothRank(b);
    });
  }, [stage?.mediaAssets]);

  const mediaBranchTypes = useMemo(
    () =>
      listMediaBranchTypes(
        (stage?.requirementInstances ?? []).map((r) => ({
          required: r.mediaRequirement.required,
          mediaType: r.mediaRequirement.mediaType,
          code: r.mediaRequirement.code,
        })),
      ),
    [stage?.requirementInstances],
  );
  const mixedMediaBranches =
    stage?.stageTemplate.code !== 'IMPRESSIONS_OR_SCANS' &&
    hasMixedMediaBranches(
      (stage?.requirementInstances ?? []).map((r) => ({
        required: r.mediaRequirement.required,
        mediaType: r.mediaRequirement.mediaType,
        code: r.mediaRequirement.code,
      })),
    );

  function openViewer(asset: MediaAssetDto) {
    // Единая лента по порядку протокола: 1 → 2 → 3 (зубы 18…48) → …
    const index = Math.max(0, assets.findIndex((a) => a.id === asset.id));
    setViewer({
      assets,
      index,
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
    if (!canDelete) return;
    const seq = Math.max(1, assets.findIndex((a) => a.id === asset.id) + 1);
    const title = assetTitle(asset, seq);
    if (!canDeleteAsset(asset)) {
      setError(
        `Нельзя удалить «${title}»: это обязательный минимум для положения. Загрузите замену или оставьте файл.`,
      );
      return;
    }
    if (!(await confirmDelete(`Удалить файл «${title}»?`))) return;
    setBusyMedia(true);
    setError(null);
    setMessage(null);
    try {
      await mediaApi.archive(asset.id);
      setMessage(`Файл удалён: ${title}`);
      if (viewer) setViewer(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить файл');
    } finally {
      setBusyMedia(false);
    }
  }

  async function handleCleanupDuplicates() {
    if (!canDelete) return;
    if (
      !(await confirmDelete(
        'Удалить лишние (задвоенные) файлы? По каждому положению останется только обязательное количество.',
      ))
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

  const isClosed = stage?.status === 'CLOSED';
  const canCloseThisStage = canCloseStage(stage?.startedByUserId);
  /** После закрытия состав файлов правит только модератор. */
  const mediaEditable = !isReadOnly && (!isClosed || canEditClosedStage);

  async function handleCloseStage() {
    if (
      !window.confirm(
        'Закрыть этап? После закрытия состав файлов сможет менять только модератор.',
      )
    ) {
      return;
    }
    setClosing(true);
    setError(null);
    setMessage(null);
    try {
      await stagesApi.close(stageId);
      setMessage('Этап закрыт');
      await load();
    } catch (err) {
      const reasons =
        err instanceof ApiError
          ? (err.body as { blockingReasons?: string[] } | undefined)?.blockingReasons
          : undefined;
      const base = err instanceof Error ? err.message : 'Не удалось закрыть этап';
      setError(reasons?.length ? `${base}: ${reasons.join('; ')}` : base);
    } finally {
      setClosing(false);
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

      {error ? <div className="alert-error mb-4 mt-4">{error}</div> : null}
      {message ? <div className="mb-4 mt-4 text-sm text-status-success">{message}</div> : null}

      {stage.stageTemplate.code === 'JAW_RELATION' ? (
        <JawRelationBanner stageCode={stage.stageTemplate.code} completeness={completeness} />
      ) : null}

      {stage.stageTemplate.code === 'IMPRESSIONS_OR_SCANS' ? (
        <ImpressionCaptureModeToggle
          value={stage.impressionCaptureMode}
          busy={modeBusy}
          disabled={stage.status === 'CLOSED' || isReadOnly}
          onChange={(mode) => {
            void (async () => {
              setModeBusy(true);
              setError(null);
              try {
                await stagesApi.setImpressionCaptureMode(stageId, mode);
                setMessage(
                  mode === 'SCAN'
                    ? 'Выбран скан: обязательны STL/OBJ верхней и нижней челюсти.'
                    : 'Выбран оттиск: обязательны фото оттисков ВЧ и НЧ.',
                );
                await load();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : 'Не удалось сохранить способ получения',
                );
              } finally {
                setModeBusy(false);
              }
            })();
          }}
        />
      ) : null}

      {mixedMediaBranches ? (
        <MediaBranchModeToggle
          types={mediaBranchTypes}
          value={stage.mediaBranchMode}
          busy={modeBusy}
          disabled={stage.status === 'CLOSED' || isReadOnly}
          onChange={(mode) => {
            void (async () => {
              setModeBusy(true);
              setError(null);
              try {
                await stagesApi.setMediaBranchMode(stageId, mode);
                setMessage(
                  mode === 'ALL'
                    ? 'Для закрытия этапа нужны все виды информации.'
                    : `Для закрытия этапа обязателен вид: ${MEDIA_BRANCH_LABELS[mode] ?? mode}.`,
                );
                await load();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : 'Не удалось сохранить вид информации',
                );
              } finally {
                setModeBusy(false);
              }
            })();
          }}
        />
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <CompletenessSummary completeness={completeness} />
        <div className="card">
          <h2 className="mb-3 text-base font-semibold">Действия</h2>
          <div className="flex flex-wrap gap-2">
            {mediaEditable ? (
              <Link href={`/cases/${caseId}/stages/${stageId}/upload`} className="btn-primary">
                Загрузить материалы
              </Link>
            ) : null}
            <button
              type="button"
              className="btn-secondary"
              disabled={closing || isClosed || isReadOnly || !canCloseThisStage}
              onClick={() => void handleCloseStage()}
              title={
                isReadOnly
                  ? 'В режиме просмотра закрытие этапа недоступно'
                  : isClosed
                    ? 'Этап уже закрыт'
                    : !canCloseThisStage
                      ? 'Закрыть этап может главный врач или врач, который начал этот этап'
                      : 'Подтвердить и закрыть этап при полной комплектности'
              }
            >
              {closing ? 'Закрытие…' : isClosed ? 'Этап закрыт' : 'Закрыть этап'}
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            {isClosed
              ? mediaEditable
                ? 'Этап закрыт. Состав файлов доступен для правки только модератору.'
                : 'Этап закрыт. Загрузка и удаление файлов недоступны — обратитесь к модератору.'
              : 'Закрыть этап могут главный врач и врач, который начал этот этап. После закрытия состав файлов сможет менять только модератор.'}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Медиаматериалы</h2>
          {assets.length > 0 && canDelete ? (
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
        {assets.length ? (
          <ul className="space-y-1 text-sm">
            {assets.map((asset, idx) => {
              const title = assetTitle(asset, idx + 1);
              const deletable = canDeleteAsset(asset);
              return (
                <li key={asset.id} className="flex items-center justify-between gap-3 border-b border-border py-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left text-accent underline-offset-2 hover:underline"
                    onClick={() => openViewer(asset)}
                  >
                    <span className="font-medium">{title}</span>
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      className="btn-secondary shrink-0 !px-2 !py-1 text-xs"
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
                  ) : null}
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
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  );
}
