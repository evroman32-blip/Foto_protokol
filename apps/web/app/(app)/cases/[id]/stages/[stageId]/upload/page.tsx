'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { MediaViewer } from '@/components/MediaViewer';
import { PageHeader } from '@/components/PageHeader';
import { StageTabs } from '@/components/StageTabs';
import { LoadingState } from '@/components/States';
import {
  mediaApi,
  stagesApi,
  uploadApi,
  type MediaAssetDto,
  type RequirementInstanceDto,
} from '@/lib/api';

type MediaTab = 'photo' | 'video' | 'docs' | 'stl' | 'radiology' | 'checklist' | 'history';

const TAB_TO_MEDIA: Record<string, string | null> = {
  photo: 'PHOTO',
  video: 'VIDEO',
  docs: 'DOCUMENT',
  stl: 'STL',
  radiology: null,
  checklist: null,
  history: null,
};

const ACCEPT_BY_TYPE: Record<string, string> = {
  PHOTO: 'image/jpeg,image/png,image/tiff,image/webp,.jpg,.jpeg,.png,.tif,.tiff',
  VIDEO: 'video/mp4,video/quicktime,.mp4,.mov',
  DOCUMENT: 'application/pdf,.pdf,.stl,model/stl,application/sla',
  STL: '.stl,model/stl,application/sla,application/vnd.ms-pki.stl,model/x.stl-ascii,model/x.stl-binary',
  RADIOLOGY: 'image/*,application/pdf,.dcm,.dicom,.zip',
  RADIOLOGY_IMAGE: 'image/*,application/pdf,.dcm,.dicom,.zip',
  RADIOLOGY_STUDY: 'image/*,application/pdf,.dcm,.dicom,.zip',
  DICOM_SERIES: '.dcm,.dicom,.zip,application/dicom',
};

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
    case 'RADIOLOGY':
    case 'RADIOLOGY_IMAGE':
    case 'RADIOLOGY_STUDY':
      return 'Рентген';
    case 'DICOM_SERIES':
      return 'DICOM';
    default:
      return mediaType;
  }
}

function resolveMimeType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.stl')) return 'model/stl';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

function assetsForRequirement(assets: MediaAssetDto[], requirementInstanceId: string, code: string) {
  return assets.filter((a) =>
    (a.assignments ?? []).some(
      (asg) =>
        asg.status !== 'REJECTED' &&
        (asg.requirementInstanceId === requirementInstanceId || asg.requirementCode === code),
    ),
  );
}

export default function StageUploadPage() {
  const { id: caseId, stageId } = useParams<{ id: string; stageId: string }>();
  const [requirements, setRequirements] = useState<RequirementInstanceDto[]>([]);
  const [assets, setAssets] = useState<MediaAssetDto[]>([]);
  const [filesByReq, setFilesByReq] = useState<Record<string, File | null>>({});
  const [slotStatus, setSlotStatus] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<MediaTab>('photo');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ assets: MediaAssetDto[]; index: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stage = await stagesApi.get(stageId);
      const reqs = [...(stage.requirementInstances ?? [])]
        .filter((r) => r.mediaRequirement.isActive !== false)
        .sort(
          (a, b) => (a.mediaRequirement.sortOrder ?? 0) - (b.mediaRequirement.sortOrder ?? 0),
        );
      setRequirements(reqs);
      setAssets(stage.mediaAssets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить требования этапа');
    } finally {
      setLoading(false);
    }
  }, [stageId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRequirements = useMemo(() => {
    const mediaType = TAB_TO_MEDIA[activeTab];
    if (!mediaType) return requirements;
    return requirements.filter((r) => r.mediaRequirement.mediaType === mediaType);
  }, [requirements, activeTab]);

  const pendingCount = useMemo(
    () => Object.values(filesByReq).filter(Boolean).length,
    [filesByReq],
  );

  const typeAssetsSorted = useMemo(() => {
    const mediaType = TAB_TO_MEDIA[activeTab];
    const list = mediaType ? assets.filter((a) => a.mediaType === mediaType) : assets;
    return [...list].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  }, [assets, activeTab]);

  function setFile(requirementInstanceId: string, file: File | null) {
    setFilesByReq((prev) => ({ ...prev, [requirementInstanceId]: file }));
  }

  function openViewerForRequirement(ri: RequirementInstanceDto) {
    const code = ri.mediaRequirement.code;
    const current = assetsForRequirement(assets, ri.id, code);
    if (!current.length) return;
    const mediaType = ri.mediaRequirement.mediaType;
    const sameType = [...assets]
      .filter((a) => a.mediaType === mediaType)
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    const index = Math.max(
      0,
      sameType.findIndex((a) => a.id === current[0].id),
    );
    setViewer({ assets: sameType, index });
  }

  async function handleDeleteAsset(asset: MediaAssetDto, needed: number) {
    const code =
      asset.requirementCode ??
      asset.assignments?.find((a) => a.status !== 'REJECTED')?.requirementCode ??
      '';
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
    if (siblings.length < needed) {
      setError('Нельзя удалить: останется меньше обязательного минимума для положения');
      return;
    }
    if (!window.confirm('Удалить этот файл?')) return;
    setBusy(true);
    setError(null);
    try {
      await mediaApi.archive(asset.id);
      setMessage('Файл удалён');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    } finally {
      setBusy(false);
    }
  }

  async function handleCleanupDuplicates() {
    if (
      !window.confirm(
        'Удалить задвоенные файлы этапа? По каждому положению останется обязательный минимум.',
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await mediaApi.cleanupDuplicates(stageId);
      setMessage(result.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка очистки');
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload() {
    const entries = Object.entries(filesByReq).filter(([, file]) => !!file) as [string, File][];
    if (!entries.length) {
      setError('Выберите файлы хотя бы для одного положения');
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    setProgress(0);

    try {
      const { batchId } = await uploadApi.createBatch(stageId);
      let done = 0;

      for (const [requirementInstanceId, file] of entries) {
        const req = requirements.find((r) => r.id === requirementInstanceId);
        const code = req?.mediaRequirement.code ?? '';
        const name = req?.mediaRequirement.name ?? requirementInstanceId;
        const order = req?.mediaRequirement.sortOrder;
        setSlotStatus((prev) => ({
          ...prev,
          [requirementInstanceId]: order ? `${order}. Замена/загрузка…` : 'Загрузка…',
        }));

        const existing = assetsForRequirement(assets, requirementInstanceId, code);

        const mimeType = resolveMimeType(file);
        const presign = await uploadApi.presign(batchId, {
          filename: file.name,
          mimeType,
          size: file.size,
        });

        await uploadApi.uploadFile(presign, file, (pct) => {
          const overall = Math.round(((done + pct / 100) / entries.length) * 100);
          setProgress(overall);
        });

        const asset = await uploadApi.completeFile(batchId, {
          uploadId: presign.uploadId,
          objectKey: presign.objectKey,
          originalFileName: file.name,
          mimeType,
          fileSizeBytes: file.size,
        });

        await mediaApi.assign(asset.id, {
          requirementInstanceId,
          requirementCode: code,
          source: 'DOCTOR',
        });

        // Archive previous files only after the new one is assigned (keeps required minimum).
        for (const old of existing) {
          await mediaApi.archive(old.id);
        }

        setSlotStatus((prev) => ({
          ...prev,
          [requirementInstanceId]: existing.length
            ? `Заменено: ${order ? `${order}. ` : ''}${name}`
            : `Загружено: ${order ? `${order}. ` : ''}${name}`,
        }));
        done += 1;
        setProgress(Math.round((done / entries.length) * 100));
      }

      await uploadApi.completeBatch(batchId);
      setFilesByReq({});
      setMessage(`Сохранено позиций: ${entries.length}`);
      setProgress(100);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Загрузка требований этапа…" />;

  return (
    <div>
      <PageHeader
        title="Загрузка материалов"
        description="Нумерация совпадает с протоколом. Можно заменить уже загруженный файл."
        actions={
          <Link href={`/cases/${caseId}/stages/${stageId}`} className="btn-secondary">
            Назад к этапу
          </Link>
        }
      />

      <StageTabs active={activeTab} onChange={(tab) => setActiveTab(tab as MediaTab)} />

      {error ? <div className="alert-error mb-4 mt-4">{error}</div> : null}
      {message ? <div className="mb-4 mt-4 text-sm text-status-success">{message}</div> : null}

      {activeTab === 'radiology' || activeTab === 'checklist' || activeTab === 'history' ? (
        <div className="card mt-4 text-sm text-gray-600">
          Для этой вкладки используйте соответствующие разделы этапа (рентгенология / чек-лист / история).
        </div>
      ) : null}

      {TAB_TO_MEDIA[activeTab] && visibleRequirements.length === 0 ? (
        <div className="card mt-4 text-sm text-gray-600">
          Для этой вкладки в шаблоне этапа нет требований к материалам.
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {visibleRequirements.map((ri) => {
          const req = ri.mediaRequirement;
          const currentAssets = assetsForRequirement(assets, ri.id, req.code);
          const assigned = currentAssets.length;
          const needed = Math.max(req.minCount || (req.required ? 1 : 0), 0);
          const filled = assigned >= needed && needed > 0;
          const selected = filesByReq[ri.id];
          const order = req.sortOrder;

          return (
            <div key={ri.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-graphite">
                    {order != null ? `${order}. ` : ''}
                    {req.name}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {mediaTypeLabel(req.mediaType)} · код {req.code}
                  </div>
                </div>
                <div className="text-right text-xs">
                  {req.required ? (
                    <span className="badge-muted">{filled ? 'Заполнено' : 'Обязательно'}</span>
                  ) : (
                    <span className="badge-muted">Опционально</span>
                  )}
                  <div className="mt-1 text-gray-500">
                    загружено: {assigned}
                    {needed > 0 ? ` / ${needed}` : ''}
                  </div>
                </div>
              </div>

              {currentAssets.length > 0 ? (
                <div className="space-y-2 rounded border border-border bg-surface-muted/40 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      className="text-left text-accent underline-offset-2 hover:underline"
                      onClick={() => openViewerForRequirement(ri)}
                    >
                      Файлов по положению: {currentAssets.length}
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {currentAssets.map((asset, idx) => {
                      const canDelete = currentAssets.length - 1 >= needed;
                      return (
                        <li key={asset.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-gray-600">
                            #{idx + 1} · {asset.status}
                          </span>
                          <button
                            type="button"
                            className="text-accent underline-offset-2 hover:underline disabled:opacity-40"
                            disabled={busy || !canDelete}
                            title={
                              canDelete
                                ? 'Удалить этот файл'
                                : 'Нельзя удалить: обязательный минимум'
                            }
                            onClick={() => void handleDeleteAsset(asset, needed)}
                          >
                            Удалить
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="text-xs text-gray-500">
                    Выберите новый файл ниже, чтобы заменить. Лишние можно удалить, если минимум
                    ({needed || 0}) сохраняется.
                  </div>
                </div>
              ) : null}

              <div>
                <label className="label-field" htmlFor={`file-${ri.id}`}>
                  {currentAssets.length ? 'Заменить файл' : 'Файл для положения'}
                </label>
                <input
                  id={`file-${ri.id}`}
                  type="file"
                  accept={ACCEPT_BY_TYPE[req.mediaType] ?? '*/*'}
                  className="input-field"
                  disabled={busy}
                  onChange={(e) => setFile(ri.id, e.target.files?.[0] ?? null)}
                />
                {selected ? (
                  <div className="mt-1 text-xs text-gray-600">Выбрано: {selected.name}</div>
                ) : null}
                {slotStatus[ri.id] ? (
                  <div className="mt-1 text-xs text-status-success">{slotStatus[ri.id]}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {TAB_TO_MEDIA[activeTab] && visibleRequirements.length > 0 ? (
        <div className="card mt-4 max-w-xl space-y-3">
          {progress !== null ? (
            <div>
              <div className="mb-1 text-sm text-gray-600">Прогресс: {progress}%</div>
              <div className="h-2 overflow-hidden rounded bg-surface-muted">
                <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="btn-primary"
            disabled={busy || pendingCount === 0}
            onClick={() => void handleUpload()}
          >
            {busy
              ? 'Сохранение…'
              : `Сохранить выбранные (${pendingCount})`}
          </button>

          {typeAssetsSorted.length > 0 ? (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setViewer({ assets: typeAssetsSorted, index: 0 })}
              >
                Просмотреть все «{mediaTypeLabel(TAB_TO_MEDIA[activeTab] ?? '')}» ({typeAssetsSorted.length})
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => void handleCleanupDuplicates()}
              >
                Удалить дубликаты этапа
              </button>
            </>
          ) : null}
        </div>
      ) : null}

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
