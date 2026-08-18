'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MediaViewer } from '@/components/MediaViewer';
import {
  ImplantSliceCardsForm,
  type SliceCardsHandle,
} from '@/components/ImplantSliceCardsForm';
import { ImpressionCaptureModeToggle } from '@/components/ImpressionCaptureModeToggle';
import { MediaBranchModeToggle } from '@/components/MediaBranchModeToggle';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import {
  mediaApi,
  stagesApi,
  uploadApi,
  type MediaAssetDto,
  type RequirementInstanceDto,
} from '@/lib/api';
import { confirmDelete } from '@/lib/confirm-delete';
import {
  isRequirementEffectivelyRequired,
  requirementInactiveHint,
} from '@/lib/impression-mode';
import {
  MEDIA_BRANCH_LABELS,
  hasMixedMediaBranches,
  isImplantSliceCardsRequirement,
  isMediaBranchRequirementActive,
  listMediaBranchTypes,
  mediaBranchInactiveHint,
} from '@/lib/media-branch-mode';
import {
  attachDocumentFileDropGuard,
  preventBrowserFileNavigation,
} from '@/lib/prevent-file-navigation';
import {
  prepareScanUpload,
  SCAN_MAX_BYTES,
  suggestScanSlotCode,
} from '@/lib/scan-bundle';
import { useCurrentUser } from '@/lib/use-current-user';

const DESIRED_TOOTH_SHADES = ['BL1', 'BL2', 'BL3', 'BL4', 'B1', 'A1', 'A2', 'A3', 'A4'] as const;

function isUploadableMediaType(mediaType: string) {
  return ![
    'STRUCTURED_DATA',
    'STRUCTURED_CONFIRMATION',
    'RADIOLOGY_STUDY',
    'DICOM_SERIES',
  ].includes(mediaType);
}

function isScanRequirement(req: { mediaType?: string; code?: string; name?: string }) {
  if (req.mediaType === 'STL') return true;
  const code = (req.code ?? '').toUpperCase();
  const name = (req.name ?? '').toLowerCase();
  if (/(SCAN|SKAN|STL|OBJ)/.test(code)) return true;
  return /скан|stl|obj|3d-?модел/.test(name);
}

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
  const [requirements, setRequirements] = useState<RequirementInstanceDto[]>([]);
  const [assets, setAssets] = useState<MediaAssetDto[]>([]);
  /** Выбранные к загрузке файлы по requirementInstanceId (несколько — если minCount > 1). */
  const [filesByReq, setFilesByReq] = useState<Record<string, File[]>>({});
  const [slotStatus, setSlotStatus] = useState<Record<string, string>>({});
  const [stageCode, setStageCode] = useState<string | undefined>();
  const [stageStatus, setStageStatus] = useState<string | undefined>();
  const [impressionCaptureMode, setImpressionCaptureMode] = useState<
    'SCAN' | 'IMPRESSION' | null
  >(null);
  const [mediaBranchMode, setMediaBranchMode] = useState<string | null>(null);
  const [desiredToothShade, setDesiredToothShade] = useState<string>('');
  const [shadeBusy, setShadeBusy] = useState(false);
  const [modeBusy, setModeBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ assets: MediaAssetDto[]; index: number } | null>(null);
  /** Очередь срезов имплантатов — сохраняется той же кнопкой, что и остальные положения. */
  const sliceFormRef = useRef<SliceCardsHandle>(null);
  const [slicePending, setSlicePending] = useState(0);
  const { canEditClosedStage, isReadOnly, canDelete } = useCurrentUser();

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const stage = await stagesApi.get(stageId);
      setStageCode(stage.stageTemplate.code);
      setStageStatus(stage.status);
      setImpressionCaptureMode(stage.impressionCaptureMode ?? null);
      setMediaBranchMode(stage.mediaBranchMode ?? null);
      setDesiredToothShade(stage.desiredToothShade ?? '');
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
      if (!opts?.silent) setLoading(false);
    }
  }, [stageId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Drag&drop файла вне input иначе открывает снимок во вкладке браузера.
  useEffect(() => attachDocumentFileDropGuard(), []);

  /** Закрытый этап правят только главный врач и админ. Эксперт — только просмотр. */
  const stageLocked = isReadOnly || (stageStatus === 'CLOSED' && !canEditClosedStage);
  const canUpload = !stageLocked;

  const numberedRequirements = useMemo(() => {
    return [...requirements]
      .filter(
        (r) =>
          r.mediaRequirement.isActive !== false &&
          (isImplantSliceCardsRequirement(r.mediaRequirement) ||
            isUploadableMediaType(r.mediaRequirement.mediaType)),
      )
      .sort((a, b) => {
        const ao = a.mediaRequirement.sortOrder ?? 0;
        const bo = b.mediaRequirement.sortOrder ?? 0;
        if (ao !== bo) return ao - bo;
        return (a.mediaRequirement.code ?? '').localeCompare(b.mediaRequirement.code ?? '');
      });
  }, [requirements]);

  /** Обычные положения для файловых карточек — без формы срезов КТ. */
  const protocolOrderedRequirements = useMemo(
    () => numberedRequirements.filter((r) => !isImplantSliceCardsRequirement(r.mediaRequirement)),
    [numberedRequirements],
  );

  const sliceCardRequirements = useMemo(
    () => numberedRequirements.filter((r) => isImplantSliceCardsRequirement(r.mediaRequirement)),
    [numberedRequirements],
  );
  const hasSliceCards = sliceCardRequirements.length > 0;

  const protocolNumberById = useMemo(() => {
    const map = new Map<string, number>();
    numberedRequirements.forEach((r, idx) => {
      map.set(r.id, idx + 1);
    });
    return map;
  }, [numberedRequirements]);

  const sliceCardHeading = useMemo(() => {
    const first = sliceCardRequirements[0];
    if (!first) return 'Карточки срезов имплантатов';
    const order = protocolNumberById.get(first.id);
    return `${order != null ? `${order}. ` : ''}${first.mediaRequirement.name}`;
  }, [sliceCardRequirements, protocolNumberById]);

  const mediaBranchTypes = useMemo(
    () =>
      listMediaBranchTypes(
        protocolOrderedRequirements.map((r) => ({
          required: r.mediaRequirement.required,
          mediaType: r.mediaRequirement.mediaType,
          code: r.mediaRequirement.code,
          name: r.mediaRequirement.name,
          specialRule: r.mediaRequirement.specialRule,
        })),
      ),
    [protocolOrderedRequirements],
  );
  const mixedMediaBranches =
    stageCode !== 'IMPRESSIONS_OR_SCANS' && hasMixedMediaBranches(
      protocolOrderedRequirements.map((r) => ({
        required: r.mediaRequirement.required,
        mediaType: r.mediaRequirement.mediaType,
        code: r.mediaRequirement.code,
        name: r.mediaRequirement.name,
        specialRule: r.mediaRequirement.specialRule,
      })),
    );

  const pendingCount = useMemo(
    () => Object.values(filesByReq).reduce((n, files) => n + (files?.length ?? 0), 0),
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

  async function setScanFiles(
    requirementInstanceId: string,
    fileList: FileList | null,
    code?: string,
  ) {
    if (!fileList?.length) {
      setFilesByReq((prev) => ({ ...prev, [requirementInstanceId]: [] }));
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
      setFilesByReq((prev) => ({ ...prev, [requirementInstanceId]: [prepared.file] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подготовить скан');
      setFilesByReq((prev) => ({ ...prev, [requirementInstanceId]: [] }));
      setSlotStatus((prev) => ({ ...prev, [requirementInstanceId]: '' }));
    }
  }

  function setFiles(requirementInstanceId: string, fileList: FileList | null, mediaType?: string) {
    setError(null);
    const files = fileList ? Array.from(fileList) : [];
    setFilesByReq((prev) => ({ ...prev, [requirementInstanceId]: files }));
    if (files.length && mediaType !== 'STL') {
      setSlotStatus((prev) => ({ ...prev, [requirementInstanceId]: '' }));
    }
  }

  function openViewerForRequirement(ri: RequirementInstanceDto, startAssetId?: string) {
    const code = ri.mediaRequirement.code;
    const current = assetsForRequirement(assets, ri.id, code);
    if (!current.length) return;
    const index = startAssetId
      ? Math.max(0, current.findIndex((a) => a.id === startAssetId))
      : 0;
    // Только файлы этого положения — иначе «листается» весь этап и кажется, что видео одно.
    setViewer({ assets: current, index });
  }

  async function handleDeleteAsset(asset: MediaAssetDto, needed: number) {
    if (!canDelete) return;
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
    if (!(await confirmDelete('Удалить этот файл?'))) return;
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
    if (!canDelete) return;
    if (
      !(await confirmDelete(
        'Удалить задвоенные файлы этапа? По каждому положению останется обязательный минимум.',
      ))
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
    const entries = Object.entries(filesByReq).filter(
      (entry): entry is [string, File[]] => (entry[1]?.length ?? 0) > 0,
    );
    const pendingSlices = sliceFormRef.current?.pendingCount ?? 0;
    if (!entries.length && !pendingSlices) {
      setError('Выберите файлы хотя бы для одного положения');
      return;
    }

    const totalFiles = entries.reduce((n, [, files]) => n + files.length, 0);

    setBusy(true);
    setError(null);
    setMessage(null);
    setProgress(entries.length ? 0 : null);

    try {
      let done = 0;
      const batchId = entries.length ? (await uploadApi.createBatch(stageId)).batchId : null;
      if (batchId) {

      for (const [requirementInstanceId, files] of entries) {
        const req = requirements.find((r) => r.id === requirementInstanceId);
        const code = req?.mediaRequirement.code ?? '';
        const name = req?.mediaRequirement.name ?? requirementInstanceId;
        const order = req?.mediaRequirement.sortOrder;
        const minNeeded = Math.max(
          req?.mediaRequirement.minCount ?? 0,
          isRequirementEffectivelyRequired({
            stageCode,
            impressionCaptureMode,
            code,
            templateRequired: req?.mediaRequirement.required ?? true,
          }) &&
            isMediaBranchRequirementActive({
              stageCode,
              mediaBranchMode,
              mixedMediaBranches,
              mediaType: req?.mediaRequirement.mediaType ?? '',
              templateRequired: req?.mediaRequirement.required ?? true,
            })
            ? 1
            : 0,
        );
        const maxCount = req?.mediaRequirement.maxCount ?? null;
        // Одно слотовое положение (фото 1 шт.): новый файл заменяет старый.
        // При minCount > 1 — догружаем, не стирая уже загруженные.
        const replaceMode = minNeeded <= 1 && (maxCount == null || maxCount <= 1);

        let existing = assetsForRequirement(assets, requirementInstanceId, code);

        for (const file of files) {
          setSlotStatus((prev) => ({
            ...prev,
            [requirementInstanceId]: order
              ? `${order}. ${replaceMode && existing.length ? 'Замена' : 'Загрузка'}…`
              : 'Загрузка…',
          }));

          const mimeType = resolveMimeType(file);
          const presign = await uploadApi.presign(batchId, {
            filename: file.name,
            mimeType,
            size: file.size,
          });

          await uploadApi.uploadFile(batchId, presign, file, (pct) => {
            const overall = Math.round(((done + pct / 100) / totalFiles) * 100);
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

          if (replaceMode && canDelete) {
            for (const old of existing) {
              await mediaApi.archive(old.id);
            }
            existing = [asset];
          } else {
            // Добавление до minCount / maxCount — не трогаем уже загруженные.
            existing = [asset, ...existing];
            if (canDelete && maxCount != null && existing.length > maxCount) {
              const removeList = existing.slice(maxCount);
              for (const old of removeList) {
                await mediaApi.archive(old.id);
              }
              existing = existing.slice(0, maxCount);
            }
          }

          done += 1;
          setProgress(Math.round((done / totalFiles) * 100));
        }

        setSlotStatus((prev) => ({
          ...prev,
          [requirementInstanceId]: `Сохранено (${files.length}): ${order ? `${order}. ` : ''}${name}`,
        }));
      }

        await uploadApi.completeBatch(batchId);
        setFilesByReq({});
        setProgress(100);
      }

      // Срезы имплантатов сохраняются тем же действием, отдельным пакетом.
      let savedSlices = 0;
      if (pendingSlices && sliceFormRef.current) {
        savedSlices = await sliceFormRef.current.savePending();
      }

      const parts: string[] = [];
      if (totalFiles) parts.push(`файлов: ${totalFiles}`);
      if (savedSlices) parts.push(`срезов: ${savedSlices}`);
      setMessage(parts.length ? `Сохранено ${parts.join(', ')}` : 'Сохранено');
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
        description="Все положения этапа одним списком в порядке протокола: фото, видео, документы, 3D-сканы и рентген. Если в шаблоне указано несколько файлов — загружайте все сразу пакетом."
        actions={
          <Link href={`/cases/${caseId}/stages/${stageId}`} className="btn-secondary">
            Назад к этапу
          </Link>
        }
      />

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

      {mixedMediaBranches ? (
        <div className="mt-4">
          <MediaBranchModeToggle
            types={mediaBranchTypes}
            value={mediaBranchMode}
            busy={modeBusy}
            disabled={stageLocked}
            onChange={(mode) => {
              void (async () => {
                setModeBusy(true);
                setError(null);
                try {
                  await stagesApi.setMediaBranchMode(stageId, mode);
                  setMediaBranchMode(mode);
                  setMessage(
                    mode === 'ALL'
                      ? 'Для закрытия этапа нужны все виды информации.'
                      : `Для закрытия этапа обязателен вид: ${MEDIA_BRANCH_LABELS[mode] ?? mode}.`,
                  );
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
        </div>
      ) : null}

      {error ? <div className="alert-error mb-4 mt-4">{error}</div> : null}
      {message ? <div className="mb-4 mt-4 text-sm text-status-success">{message}</div> : null}

      {isReadOnly ? (
        <div className="card mt-4 border-status-warning/40 text-sm text-graphite">
          Режим просмотра: загрузка, замена и удаление файлов недоступны, пока модератор не
          подтвердит ваши права доступа.
        </div>
      ) : null}

      {stageStatus === 'CLOSED' && !isReadOnly ? (
        <div className="card mt-4 border-status-warning/40 text-sm text-graphite">
          {stageLocked
            ? 'Этап закрыт. Загрузка, замена и удаление файлов недоступны — изменить состав материалов может только модератор.'
            : 'Этап закрыт. Правки состава файлов доступны вам как модератору; статус этапа при этом сохраняется.'}
        </div>
      ) : null}

      {stageCode === 'POSTOP_SURGICAL_RADIOLOGY_CONTROL' ? (
        <div className="card mt-4 mb-2 text-sm text-gray-600">
          Порядок: 1) предоперационное ОПТГ, 2) послеоперационное ОПТГ, 3) карточки срезов
          имплантатов. Подтверждение хирурга выполняется при закрытии этапа.
        </div>
      ) : null}

      {protocolOrderedRequirements.length === 0 ? (
        <div className="card mt-4 text-sm text-gray-600">
          В шаблоне этапа нет требований к материалам.
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {protocolOrderedRequirements.map((ri) => {
          const req = ri.mediaRequirement;
          const currentAssets = assetsForRequirement(assets, ri.id, req.code);
          const assigned = currentAssets.length;
          const effectivelyRequired =
            isRequirementEffectivelyRequired({
              stageCode,
              impressionCaptureMode,
              code: req.code,
              templateRequired: req.required,
            }) &&
            isMediaBranchRequirementActive({
              stageCode,
              mediaBranchMode,
              mixedMediaBranches,
              mediaType: req.mediaType,
              templateRequired: req.required,
            });
          const inactiveHint =
            requirementInactiveHint({
              stageCode,
              impressionCaptureMode,
              code: req.code,
              templateRequired: req.required,
            }) ??
            mediaBranchInactiveHint({
              stageCode,
              mediaBranchMode,
              mixedMediaBranches,
              mediaType: req.mediaType,
              templateRequired: req.required,
            });
          const needed = Math.max(req.minCount || (effectivelyRequired ? 1 : 0), 0);
          const maxCount = req.maxCount ?? null;
          const multiSlot = needed > 1 || (maxCount != null && maxCount > 1);
          const filled = assigned >= needed && needed > 0;
          const selected = filesByReq[ri.id] ?? [];
          const order = protocolNumberById.get(ri.id) ?? req.sortOrder;

          return (
            <div
              key={ri.id}
              className={`card space-y-3 ${inactiveHint ? 'opacity-60' : ''}`}
              onDragEnter={preventBrowserFileNavigation}
              onDragOver={preventBrowserFileNavigation}
              onDrop={(e) => {
                preventBrowserFileNavigation(e);
                if (busy || stageLocked) return;
                const list = e.dataTransfer.files;
                if (!list?.length) return;
                if (isScanRequirement(req)) {
                  void setScanFiles(ri.id, list, req.code);
                  return;
                }
                setFiles(ri.id, list, req.mediaType);
              }}
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

              {req.instruction?.trim() ? (
                <div className="rounded border border-border bg-surface-muted/50 px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Инструкция
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-graphite">
                    {req.instruction.trim()}
                  </p>
                </div>
              ) : null}

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
                      const deletable = currentAssets.length - 1 >= needed;
                      return (
                        <li key={asset.id} className="flex items-center justify-between gap-2 text-xs">
                          <button
                            type="button"
                            className="truncate text-left text-accent underline-offset-2 hover:underline"
                            onClick={() => openViewerForRequirement(ri, asset.id)}
                          >
                            #{idx + 1} · {asset.originalFileName ?? asset.originalFilename ?? asset.status}
                          </button>
                          {canDelete ? (
                          <button
                            type="button"
                            className="text-accent underline-offset-2 hover:underline disabled:opacity-40"
                            disabled={busy || stageLocked || !deletable}
                            title={
                              deletable
                                ? 'Удалить этот файл'
                                : 'Нельзя удалить: обязательный минимум'
                            }
                            onClick={() => void handleDeleteAsset(asset, needed)}
                          >
                            Удалить
                          </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="text-xs text-gray-500">
                    {multiSlot
                      ? `Нужно файлов: ${needed}${maxCount != null ? ` (макс. ${maxCount})` : ''}. Новые добавляются к уже загруженным.`
                      : 'Новый файл заменит предыдущий. Удаление — только если минимум сохраняется.'}
                  </div>
                </div>
              ) : null}

              <div>
                <label className="label-field" htmlFor={`file-${ri.id}`}>
                  {isScanRequirement(req)
                    ? currentAssets.length
                      ? 'Заменить скан'
                      : 'Файлы скана для положения'
                    : multiSlot
                      ? currentAssets.length >= needed
                        ? 'Добавить ещё файлы'
                        : `Добавить файлы (нужно ещё ${Math.max(needed - currentAssets.length, 0)})`
                      : currentAssets.length
                        ? 'Заменить файл'
                        : 'Файл для положения'}
                </label>
                <input
                  id={`file-${ri.id}`}
                  type="file"
                  className="input-field"
                  disabled={busy || stageLocked}
                  multiple={isScanRequirement(req) || multiSlot}
                  onChange={(e) => {
                    if (isScanRequirement(req)) {
                      void setScanFiles(ri.id, e.target.files, req.code);
                    } else {
                      setFiles(ri.id, e.target.files, req.mediaType);
                    }
                  }}
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  {isScanRequirement(req) ? (
                    <>
                      Exocad (цвет): выберите сразу{' '}
                      <span className="font-medium text-graphite">.obj + .mtl + .jpg</span> одной
                      челюсти (UpperJaw / LowerJaw / TotalJaw). Можно только .stl — без цвета. Situ не
                      использовать. До {SCAN_MAX_BYTES / (1024 * 1024)} МБ. Если окно показывает только
                      JPG — внизу справа выберите «Все файлы».
                    </>
                  ) : (
                    <>
                      Если в окне выбора видны только JPG — внизу справа откройте список типов и
                      выберите «Все файлы».
                    </>
                  )}
                </p>
                {selected.length > 0 ? (
                  <div className="mt-1 text-xs text-gray-600">
                    К загрузке ({selected.length}):{' '}
                    {selected.map((f) => f.name).join(', ')}
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

      {hasSliceCards || stageCode === 'POSTOP_SURGICAL_RADIOLOGY_CONTROL' ? (
        <div className="mt-4">
          <ImplantSliceCardsForm
            ref={sliceFormRef}
            stageId={stageId}
            heading={sliceCardHeading}
            readOnly={stageLocked}
            canDelete={canDelete}
            externalSaveControl
            onPendingChange={setSlicePending}
            onChanged={() => void load({ silent: true })}
          />
        </div>
      ) : null}

      {(canUpload && (protocolOrderedRequirements.length > 0 || hasSliceCards)) ||
      slicePending > 0 ? (
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
            disabled={busy || pendingCount + slicePending === 0}
            onClick={() => void handleUpload()}
          >
            {busy
              ? 'Сохранение…'
              : `Сохранить выбранные (${pendingCount + slicePending})`}
          </button>

          {protocolAssetsSorted.length > 0 ? (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setViewer({ assets: protocolAssetsSorted, index: 0 })}
              >
                Просмотреть загруженные ({protocolAssetsSorted.length})
              </button>
              {canDelete ? (
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => void handleCleanupDuplicates()}
              >
                Удалить дубликаты этапа
              </button>
              ) : null}
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
