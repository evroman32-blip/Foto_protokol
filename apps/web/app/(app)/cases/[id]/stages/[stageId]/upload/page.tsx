'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { MediaViewer } from '@/components/MediaViewer';
import { ImplantSliceCardsForm } from '@/components/ImplantSliceCardsForm';
import { ImpressionCaptureModeToggle } from '@/components/ImpressionCaptureModeToggle';
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
import {
  isRequirementEffectivelyRequired,
  requirementInactiveHint,
} from '@/lib/impression-mode';
import {
  prepareScanUpload,
  SCAN_MAX_BYTES,
  suggestScanSlotCode,
} from '@/lib/scan-bundle';

type MediaTab = 'photo' | 'video' | 'docs' | 'stl' | 'radiology' | 'checklist' | 'history';

const DESIRED_TOOTH_SHADES = ['BL1', 'BL2', 'BL3', 'BL4', 'B1', 'A1', 'A2', 'A3', 'A4'] as const;

const TAB_MEDIA_TYPES: Record<MediaTab, string[] | null> = {
  photo: ['PHOTO'],
  video: ['VIDEO'],
  docs: ['DOCUMENT'],
  stl: ['STL'],
  radiology: ['RADIOLOGY_IMAGE', 'RADIOLOGY'],
  checklist: null,
  history: null,
};

const TAB_PRIORITY: MediaTab[] = ['photo', 'radiology', 'stl', 'video', 'docs'];

function isUploadableMediaType(mediaType: string) {
  return ![
    'STRUCTURED_DATA',
    'STRUCTURED_CONFIRMATION',
    'RADIOLOGY_STUDY',
    'DICOM_SERIES',
  ].includes(mediaType);
}

function pickDefaultTab(requirements: RequirementInstanceDto[]): MediaTab {
  const types = new Set(
    requirements
      .filter((r) => isUploadableMediaType(r.mediaRequirement.mediaType))
      .map((r) => r.mediaRequirement.mediaType),
  );
  for (const tab of TAB_PRIORITY) {
    const allowed = TAB_MEDIA_TYPES[tab];
    if (allowed?.some((t) => types.has(t))) return tab;
  }
  return 'photo';
}

const ACCEPT_BY_TYPE: Record<string, string> = {
  PHOTO: 'image/jpeg,image/png,image/tiff,image/webp,.jpg,.jpeg,.png,.tif,.tiff',
  VIDEO: 'video/mp4,video/quicktime,.mp4,.mov',
  DOCUMENT: 'application/pdf,.pdf',
  STL: [
    '.obj',
    '.mtl',
    '.jpg',
    '.jpeg',
    '.png',
    '.stl',
    'model/obj',
    'model/stl',
    'application/sla',
    'image/jpeg',
    'image/png',
  ].join(','),
  RADIOLOGY: 'image/*,application/pdf',
  RADIOLOGY_IMAGE: 'image/*,application/pdf',
};

const STL_SLOT_LABEL: Record<string, string> = {
  IMP_SCAN_UPPER: 'верхняя челюсть',
  IMP_SCAN_LOWER: 'нижняя челюсть',
  IMP_SCAN_BITE: 'прикус',
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
      return '3D-скан';
    case 'RADIOLOGY':
    case 'RADIOLOGY_IMAGE':
      return 'Рентген';
    default:
      return mediaType;
  }
}

function resolveMimeType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.stl')) return 'model/stl';
  if (lower.endsWith('.obj')) return 'model/obj';
  if (lower.endsWith('.obj.zip') || lower.endsWith('.zip')) return 'application/zip';
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
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as MediaTab | null;
  const [requirements, setRequirements] = useState<RequirementInstanceDto[]>([]);
  const [assets, setAssets] = useState<MediaAssetDto[]>([]);
  const [filesByReq, setFilesByReq] = useState<Record<string, File | null>>({});
  const [slotStatus, setSlotStatus] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<MediaTab>(tabFromUrl && TAB_MEDIA_TYPES[tabFromUrl] !== undefined ? tabFromUrl : 'photo');
  const [stageCode, setStageCode] = useState<string | undefined>();
  const [impressionCaptureMode, setImpressionCaptureMode] = useState<
    'SCAN' | 'IMPRESSION' | null
  >(null);
  const [desiredToothShade, setDesiredToothShade] = useState<string>('');
  const [shadeBusy, setShadeBusy] = useState(false);
  const [modeBusy, setModeBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ assets: MediaAssetDto[]; index: number } | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const stage = await stagesApi.get(stageId);
      setStageCode(stage.stageTemplate.code);
      setImpressionCaptureMode(stage.impressionCaptureMode ?? null);
      setDesiredToothShade(stage.desiredToothShade ?? '');
      const reqs = [...(stage.requirementInstances ?? [])]
        .filter((r) => r.mediaRequirement.isActive !== false)
        .sort(
          (a, b) => (a.mediaRequirement.sortOrder ?? 0) - (b.mediaRequirement.sortOrder ?? 0),
        );
      setRequirements(reqs);
      setAssets(stage.mediaAssets ?? []);
      setActiveTab((prev) => {
        if (tabFromUrl && TAB_MEDIA_TYPES[tabFromUrl] != null) return tabFromUrl;
        const preferred = pickDefaultTab(reqs);
        const prevTypes = TAB_MEDIA_TYPES[prev];
        const prevHas =
          prevTypes?.some((t) =>
            reqs.some(
              (r) =>
                isUploadableMediaType(r.mediaRequirement.mediaType) &&
                r.mediaRequirement.mediaType === t,
            ),
          ) ?? false;
        return prevHas ? prev : preferred;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить требования этапа');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [stageId, tabFromUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabMediaTypes = TAB_MEDIA_TYPES[activeTab];
  const canUploadOnTab = tabMediaTypes != null;

  /** Все активные положения шаблона в порядке протокола. */
  const protocolOrderedRequirements = useMemo(() => {
    return [...requirements]
      .filter(
        (r) =>
          r.mediaRequirement.isActive !== false &&
          isUploadableMediaType(r.mediaRequirement.mediaType),
      )
      .sort((a, b) => {
        const ao = a.mediaRequirement.sortOrder ?? 0;
        const bo = b.mediaRequirement.sortOrder ?? 0;
        if (ao !== bo) return ao - bo;
        return (a.mediaRequirement.code ?? '').localeCompare(b.mediaRequirement.code ?? '');
      });
  }, [requirements]);

  const protocolNumberById = useMemo(() => {
    const map = new Map<string, number>();
    protocolOrderedRequirements.forEach((r, idx) => {
      map.set(r.id, idx + 1);
    });
    return map;
  }, [protocolOrderedRequirements]);

  const visibleRequirements = useMemo(() => {
    // Чек-лист / история — без карточек загрузки.
    if (!tabMediaTypes) return [];
    // Все активные положения шаблона (фото + рентген + …),
    // чтобы нумерация и состав совпадали с админкой протокола.
    return protocolOrderedRequirements;
  }, [tabMediaTypes, protocolOrderedRequirements]);

  const tabsWithRequirements = useMemo(() => {
    const types = new Set(
      requirements
        .filter((r) => isUploadableMediaType(r.mediaRequirement.mediaType))
        .map((r) => r.mediaRequirement.mediaType),
    );
    return TAB_PRIORITY.filter((tab) => TAB_MEDIA_TYPES[tab]?.some((t) => types.has(t)));
  }, [requirements]);

  const pendingCount = useMemo(
    () => Object.values(filesByReq).filter(Boolean).length,
    [filesByReq],
  );

  const protocolAssetsSorted = useMemo(() => {
    const fdiOrder = [
      '18', '17', '16', '15', '14', '13', '12', '11',
      '28', '27', '26', '25', '24', '23', '22', '21',
      '38', '37', '36', '35', '34', '33', '32', '31',
      '48', '47', '46', '45', '44', '43', '42', '41',
    ];
    const toothRank = (a: MediaAssetDto) => {
      const tooth =
        a.toothPositionFdi ??
        (a.displayName?.match(/\b(\d{2})\b/)?.[1] ??
          a.originalFileName?.match(/\b(\d{2})\b/)?.[1] ??
          null);
      if (!tooth) return 999;
      const idx = fdiOrder.indexOf(tooth);
      return idx === -1 ? 999 : idx;
    };
    return [...assets].sort((a, b) => {
      const so = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
      if (so !== 0) return so;
      return toothRank(a) - toothRank(b);
    });
  }, [assets]);

  const typeAssetsSorted = useMemo(() => {
    if (!tabMediaTypes) return protocolAssetsSorted;
    // На вкладке рентгена показываем всю ленту протокола (ОПТГ + срезы),
    // даже если у срезов mediaType ещё PHOTO.
    if (activeTab === 'radiology') return protocolAssetsSorted;
    return protocolAssetsSorted.filter((a) => tabMediaTypes.includes(a.mediaType));
  }, [protocolAssetsSorted, tabMediaTypes, activeTab]);

  async function setScanFiles(
    requirementInstanceId: string,
    fileList: FileList | null,
    code?: string,
  ) {
    if (!fileList?.length) {
      setFilesByReq((prev) => ({ ...prev, [requirementInstanceId]: null }));
      return;
    }
    setError(null);
    setSlotStatus((prev) => ({
      ...prev,
      [requirementInstanceId]: 'Подготовка цветного набора…',
    }));
    try {
      const prepared = await prepareScanUpload(Array.from(fileList));
      if (prepared.file.size > SCAN_MAX_BYTES) {
        throw new Error(`Файл слишком большой (макс. ${SCAN_MAX_BYTES / (1024 * 1024)} МБ)`);
      }
      const suggested = suggestScanSlotCode(prepared.file.name);
      if (suggested && code && suggested !== code) {
        setSlotStatus((prev) => ({
          ...prev,
          [requirementInstanceId]: `По имени это похоже на «${STL_SLOT_LABEL[suggested] ?? suggested}» — проверьте слот · ${prepared.label}`,
        }));
      } else if (suggested && code && suggested === code) {
        setSlotStatus((prev) => ({
          ...prev,
          [requirementInstanceId]: `Слот «${STL_SLOT_LABEL[code] ?? code}» · ${prepared.label}`,
        }));
      } else {
        setSlotStatus((prev) => ({
          ...prev,
          [requirementInstanceId]: prepared.label,
        }));
      }
      setFilesByReq((prev) => ({ ...prev, [requirementInstanceId]: prepared.file }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подготовить скан');
      setFilesByReq((prev) => ({ ...prev, [requirementInstanceId]: null }));
      setSlotStatus((prev) => ({ ...prev, [requirementInstanceId]: '' }));
    }
  }

  function setFile(requirementInstanceId: string, file: File | null, mediaType?: string) {
    setError(null);
    setFilesByReq((prev) => ({ ...prev, [requirementInstanceId]: file }));
    if (file && mediaType !== 'STL') {
      setSlotStatus((prev) => ({ ...prev, [requirementInstanceId]: '' }));
    }
  }

  function openViewerForRequirement(ri: RequirementInstanceDto) {
    const code = ri.mediaRequirement.code;
    const current = assetsForRequirement(assets, ri.id, code);
    if (!current.length) return;
    const index = Math.max(
      0,
      protocolAssetsSorted.findIndex((a) => a.id === current[0].id),
    );
    setViewer({ assets: protocolAssetsSorted, index });
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

      <StageTabs active={activeTab} stageCode={stageCode} />

      {stageCode === 'IMPRESSIONS_OR_SCANS' ? (
        <div className="mt-4">
          <ImpressionCaptureModeToggle
            value={impressionCaptureMode}
            busy={modeBusy}
            onChange={(mode) => {
              void (async () => {
                setModeBusy(true);
                setError(null);
                try {
                  await stagesApi.setImpressionCaptureMode(stageId, mode);
                  setImpressionCaptureMode(mode);
                  setMessage(
                    mode === 'SCAN'
                      ? 'Выбран скан: обязательны STL/OBJ верхней и нижней челюсти.'
                      : 'Выбран оттиск: обязательны фото оттисков ВЧ и НЧ.',
                  );
                  if (mode === 'SCAN') setActiveTab('stl');
                  if (mode === 'IMPRESSION') setActiveTab('photo');
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
        </div>
      ) : null}

      {error ? <div className="alert-error mb-4 mt-4">{error}</div> : null}
      {message ? <div className="mb-4 mt-4 text-sm text-status-success">{message}</div> : null}

      {activeTab === 'checklist' || activeTab === 'history' ? (
        <div className="card mt-4 text-sm text-gray-600">
          Для этой вкладки используйте соответствующие разделы этапа (чек-лист / история).
        </div>
      ) : null}

      {activeTab === 'radiology' && stageCode === 'POSTOP_SURGICAL_RADIOLOGY_CONTROL' ? (
        <div className="card mt-4 mb-2 text-sm text-gray-600">
          Порядок: 1) предоперационное ОПТГ, 2) послеоперационное ОПТГ, 3) карточки срезов
          имплантатов. Сводка и подтверждение хирурга — во вкладке «Отчёт».
        </div>
      ) : null}

      {activeTab === 'radiology' &&
      stageCode !== 'POSTOP_SURGICAL_RADIOLOGY_CONTROL' &&
      requirements.some(
        (r) =>
          r.mediaRequirement.mediaType === 'STRUCTURED_CONFIRMATION' ||
          r.mediaRequirement.mediaType === 'STRUCTURED_DATA',
      ) ? (
        <div className="card mt-4 text-sm text-gray-600">
          Ниже — загрузка снимков и исследований по положениям протокола.
        </div>
      ) : null}

      {canUploadOnTab && visibleRequirements.length === 0 ? (
        <div className="card mt-4 text-sm text-gray-600">
          Для этой вкладки в шаблоне этапа нет требований к материалам.
          {tabsWithRequirements.length > 0 ? (
            <span>
              {' '}
              Материалы этапа доступны во вкладках:{' '}
              {tabsWithRequirements
                .map((t) =>
                  t === 'photo'
                    ? 'Фото'
                    : t === 'video'
                      ? 'Видео'
                      : t === 'docs'
                        ? 'Документы'
                        : t === 'stl'
                          ? '3D-скан'
                          : 'Рентгенология',
                )
                .join(', ')}
              .
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {visibleRequirements.map((ri) => {
          const req = ri.mediaRequirement;
          const currentAssets = assetsForRequirement(assets, ri.id, req.code);
          const assigned = currentAssets.length;
          const effectivelyRequired = isRequirementEffectivelyRequired({
            stageCode,
            impressionCaptureMode,
            code: req.code,
            templateRequired: req.required,
          });
          const inactiveHint = requirementInactiveHint({
            stageCode,
            impressionCaptureMode,
            code: req.code,
            templateRequired: req.required,
          });
          const needed = Math.max(req.minCount || (effectivelyRequired ? 1 : 0), 0);
          const filled = assigned >= needed && needed > 0;
          const selected = filesByReq[ri.id];
          const order = protocolNumberById.get(ri.id) ?? req.sortOrder;

          return (
            <div
              key={ri.id}
              className={`card space-y-3 ${inactiveHint ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-graphite">
                    {order != null ? `${order}. ` : ''}
                    {req.name}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {mediaTypeLabel(req.mediaType)} · код {req.code}
                  </div>
                  {req.instruction ? (
                    <div className="mt-1 text-xs text-gray-500">{req.instruction}</div>
                  ) : null}
                </div>
                <div className="text-right text-xs">
                  {inactiveHint ? (
                    <span className="badge-muted">{inactiveHint}</span>
                  ) : effectivelyRequired ? (
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

              {req.specialRule === 'desiredToothShade' ||
              req.code === 'JR_DESIRED_TOOTH_FORM_FRONT' ? (
                <div>
                  <label className="label-field" htmlFor={`shade-${ri.id}`}>
                    Желаемый цвет зубов
                  </label>
                  <select
                    id={`shade-${ri.id}`}
                    className="input-field"
                    value={desiredToothShade}
                    disabled={busy || shadeBusy}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDesiredToothShade(value);
                      if (!value) return;
                      void (async () => {
                        setShadeBusy(true);
                        setError(null);
                        try {
                          await stagesApi.setDesiredToothShade(stageId, value);
                          setMessage(`Цвет зубов сохранён: ${value}`);
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : 'Не удалось сохранить цвет зубов',
                          );
                        } finally {
                          setShadeBusy(false);
                        }
                      })();
                    }}
                  >
                    <option value="">Выберите цвет…</option>
                    {DESIRED_TOOTH_SHADES.map((shade) => (
                      <option key={shade} value={shade}>
                        {shade}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

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
                  {currentAssets.length
                    ? req.mediaType === 'STL'
                      ? 'Заменить скан'
                      : 'Заменить файл'
                    : req.mediaType === 'STL'
                      ? 'Файлы скана для положения'
                      : 'Файл для положения'}
                </label>
                <input
                  id={`file-${ri.id}`}
                  type="file"
                  accept={ACCEPT_BY_TYPE[req.mediaType] ?? '*/*'}
                  className="input-field"
                  disabled={busy}
                  multiple={req.mediaType === 'STL'}
                  onChange={(e) => {
                    if (req.mediaType === 'STL') {
                      void setScanFiles(ri.id, e.target.files, req.code);
                    } else {
                      setFile(ri.id, e.target.files?.[0] ?? null, req.mediaType);
                    }
                  }}
                />
                {req.mediaType === 'STL' ? (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Exocad (цвет): выберите сразу{' '}
                    <span className="font-medium text-graphite">.obj + .mtl + .jpg</span> одной
                    челюсти (UpperJaw / LowerJaw / TotalJaw). Можно только .stl — без цвета. Situ не
                    использовать. До {SCAN_MAX_BYTES / (1024 * 1024)} МБ.
                  </p>
                ) : null}
                {selected ? (
                  <div className="mt-1 text-xs text-gray-600">
                    К загрузке: {selected.name}
                    {selected.name.toLowerCase().endsWith('.obj.zip')
                      ? ` (${(selected.size / (1024 * 1024)).toFixed(1)} МБ)`
                      : ''}
                  </div>
                ) : null}
                {slotStatus[ri.id] ? (
                  <div className="mt-1 text-xs text-status-success">{slotStatus[ri.id]}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {activeTab === 'radiology' && stageCode === 'POSTOP_SURGICAL_RADIOLOGY_CONTROL' ? (
        <div className="mt-4">
          <ImplantSliceCardsForm stageId={stageId} onChanged={() => void load({ silent: true })} />
        </div>
      ) : null}

      {canUploadOnTab && visibleRequirements.length > 0 ? (
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
                Просмотреть загруженные ({typeAssetsSorted.length})
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
