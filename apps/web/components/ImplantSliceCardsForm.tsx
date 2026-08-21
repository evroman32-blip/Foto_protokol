'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import { radiologyApi, uploadApi, type SurgicalImplantDto } from '@/lib/api';
import { confirmDelete } from '@/lib/confirm-delete';
import {
  attachDocumentFileDropGuard,
  preventBrowserFileNavigation,
} from '@/lib/prevent-file-navigation';

type JawScope = 'UPPER' | 'LOWER';

type SectorDef = {
  id: number;
  title: string;
  teeth: string[];
};

/** Порядок зубов Strategic Implant®: от 18 к 48 по секторам */
export const FDI_TOOTH_ORDER = [
  '18', '17', '16', '15', '14', '13', '12', '11',
  '21', '22', '23', '24', '25', '26', '27', '28',
  '48', '47', '46', '45', '44', '43', '42', '41',
  '31', '32', '33', '34', '35', '36', '37', '38',
] as const;

export function fdiSortRank(tooth: string | null | undefined): number {
  if (!tooth) return 999;
  const idx = FDI_TOOTH_ORDER.indexOf(tooth as (typeof FDI_TOOTH_ORDER)[number]);
  return idx === -1 ? 999 : idx;
}

const UPPER_SECTORS: SectorDef[] = [
  {
    id: 1,
    title: 'Сектор 1',
    teeth: ['18', '17', '16', '15', '14', '13', '12', '11'],
  },
  {
    id: 2,
    title: 'Сектор 2',
    teeth: ['21', '22', '23', '24', '25', '26', '27', '28'],
  },
];

const LOWER_SECTORS: SectorDef[] = [
  {
    id: 4,
    title: 'Сектор 4',
    teeth: ['48', '47', '46', '45', '44', '43', '42', '41'],
  },
  {
    id: 3,
    title: 'Сектор 3',
    teeth: ['31', '32', '33', '34', '35', '36', '37', '38'],
  },
];

function attachmentsOf(implant: SurgicalImplantDto) {
  return implant.radiologyAttachments ?? implant.attachments ?? [];
}

function hasConfirmedSlice(implant: SurgicalImplantDto) {
  return attachmentsOf(implant).some((a) => a.surgeonConfirmed);
}

/** Челюсть определяется номером зуба, а не текущим переключателем. */
function jawOfTooth(tooth: string): JawScope {
  return tooth.startsWith('1') || tooth.startsWith('2') ? 'UPPER' : 'LOWER';
}

function isJpg(file: File) {
  return /\.jpe?g$/i.test(file.name) || file.type === 'image/jpeg';
}

export interface SliceCardsHandle {
  /** Сколько срезов предзагружено и ждёт сохранения. */
  pendingCount: number;
  /** Сохранить все предзагруженные срезы одним пакетом. Возвращает число сохранённых. */
  savePending: () => Promise<number>;
}

export const ImplantSliceCardsForm = forwardRef<
  SliceCardsHandle,
  {
    stageId: string;
    onChanged?: () => void;
    /** Сохранение запускает родительская кнопка «Сохранить выбранные». */
    externalSaveControl?: boolean;
    /** Этап закрыт: только просмотр. */
    readOnly?: boolean;
    /** Удаление сохранённых срезов — только модератор. */
    canDelete?: boolean;
    onPendingChange?: (count: number) => void;
    heading?: string;
  }
>(function ImplantSliceCardsForm(
  { stageId, onChanged, externalSaveControl = false, readOnly = false, canDelete = false, onPendingChange, heading },
  ref,
) {
  const [implants, setImplants] = useState<SurgicalImplantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyTooth, setBusyTooth] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [jawScope, setJawScope] = useState<JawScope>('UPPER');
  /** Предзагруженные (ещё не сохранённые) файлы по зубу. */
  const [pendingByTooth, setPendingByTooth] = useState<Record<string, File>>({});

  const sectors = jawScope === 'UPPER' ? UPPER_SECTORS : LOWER_SECTORS;

  const byTooth = useMemo(() => {
    const map = new Map<string, SurgicalImplantDto>();
    for (const implant of implants) {
      if (implant.toothPositionFdi) map.set(implant.toothPositionFdi, implant);
    }
    return map;
  }, [implants]);

  const pendingEntries = useMemo(() => Object.entries(pendingByTooth), [pendingByTooth]);
  const pendingCount = pendingEntries.length;

  const savedOnJaw = implants.filter((i) => i.jawScope === jawScope).length;
  const pendingOnJaw = pendingEntries.filter(([tooth]) => jawOfTooth(tooth) === jawScope).length;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        setImplants(await radiologyApi.implants(stageId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки карточек');
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [stageId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Иначе Chrome при drop файла на страницу открывает JPG во вкладке вместо загрузки.
  useEffect(() => attachDocumentFileDropGuard(), []);

  useEffect(() => {
    onPendingChange?.(pendingCount);
  }, [pendingCount, onPendingChange]);

  /** Предзагрузка: файл только запоминается, сеть не используется. */
  function stageFileForTooth(tooth: string, file: File | null) {
    if (!file) return;
    setMessage(null);
    if (!isJpg(file)) {
      setError(`Зуб ${tooth}: срез должен быть в формате JPG`);
      return;
    }
    setError(null);
    setPendingByTooth((prev) => ({ ...prev, [tooth]: file }));
  }

  function unstageTooth(tooth: string) {
    setPendingByTooth((prev) => {
      const next = { ...prev };
      delete next[tooth];
      return next;
    });
  }

  async function uploadJpgInBatch(batchId: string, file: File): Promise<string> {
    const mimeType = file.type || 'image/jpeg';
    const presign = await uploadApi.presign(batchId, {
      filename: file.name,
      mimeType,
      size: file.size,
    });
    await uploadApi.uploadFile(batchId, presign, file);
    const asset = await uploadApi.completeFile(batchId, {
      uploadId: presign.uploadId,
      objectKey: presign.objectKey,
      originalFileName: file.name,
      mimeType,
      fileSizeBytes: file.size,
    });
    const mediaId = asset.id ?? (asset as { mediaAssetId?: string }).mediaAssetId;
    if (!mediaId) throw new Error('Не получен id файла после загрузки');
    return mediaId;
  }

  /** Общее сохранение: один upload-пакет на все предзагруженные срезы. */
  const savePending = useCallback(async (): Promise<number> => {
    const entries = Object.entries(pendingByTooth);
    if (!entries.length) return 0;

    setSaving(true);
    setError(null);
    setMessage(null);
    setProgress(0);

    let done = 0;
    try {
      const { batchId } = await uploadApi.createBatch(stageId);
      // Реестр имплантатов может пополняться в процессе — держим локальную карту.
      const implantByTooth = new Map(byTooth);

      for (const [tooth, file] of entries.sort((a, b) => fdiSortRank(a[0]) - fdiSortRank(b[0]))) {
        setBusyTooth(tooth);

        let implant = implantByTooth.get(tooth);
        if (!implant) {
          const implantNumber = Number(tooth);
          implant = await radiologyApi.createImplant(stageId, {
            implantNumber: Number.isFinite(implantNumber)
              ? implantNumber
              : fdiSortRank(tooth) + 1,
            jawScope: jawOfTooth(tooth),
            toothPositionFdi: tooth,
            implantLabel: `Зуб ${tooth}`,
          });
          implantByTooth.set(tooth, implant);
        }

        const mediaAssetId = await uploadJpgInBatch(batchId, file);
        await radiologyApi.attachSlice(implant.id, {
          mediaAssetId,
          attachmentType: 'CT_CROSS_SECTION',
          surgeonConfirmed: true,
        });

        unstageTooth(tooth);
        done += 1;
        setProgress(Math.round((done / entries.length) * 100));
      }

      await uploadApi.completeBatch(batchId);
      setMessage(`Сохранено срезов: ${done}`);
      await load({ silent: true });
      onChanged?.();
      return done;
    } catch (err) {
      setError(
        err instanceof Error
          ? `Сохранено ${done} из ${entries.length}. ${err.message}`
          : 'Не удалось сохранить срезы',
      );
      await load({ silent: true });
      throw err;
    } finally {
      setBusyTooth(null);
      setSaving(false);
    }
  }, [pendingByTooth, stageId, byTooth, load, onChanged]);

  useImperativeHandle(ref, () => ({ pendingCount, savePending }), [pendingCount, savePending]);

  async function handleClearTooth(implant: SurgicalImplantDto) {
    if (!canDelete) return;
    const tooth = implant.toothPositionFdi ?? '';
    if (!(await confirmDelete(`Удалить срез зуба ${tooth || implant.implantNumber}?`))) return;
    setBusyTooth(tooth || String(implant.id));
    setError(null);
    try {
      await radiologyApi.deleteImplant(implant.id);
      setMessage(tooth ? `Окно зуба ${tooth} очищено` : 'Карточка удалена');
      await load({ silent: true });
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить');
    } finally {
      setBusyTooth(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Загрузка карточек имплантатов…</p>;
  }

  const inputsDisabled = saving || readOnly;

  return (
    <section className="card mb-6">
      <h2 className="mb-1 font-semibold text-graphite">
        {heading ?? 'Карточки срезов имплантатов'}
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        {readOnly
          ? 'Этап закрыт: срезы доступны только для просмотра.'
          : `Выберите челюсть и подгрузите JPG-срезы в окна зубов (кнопка «Выберите файл» или перетаскивание). Файлы сначала попадают в очередь, затем сохраняются все сразу${
              externalSaveControl ? ' кнопкой «Сохранить выбранные» ниже' : ''
            }. Пустые окна допустимы.`}
      </p>

      {error ? <div className="alert-error mb-3">{error}</div> : null}
      {message ? <div className="mb-3 text-sm text-status-success">{message}</div> : null}

      <div className="mb-4 max-w-xs">
        <label className="label-field">Челюсть</label>
        <select
          className="input-field"
          value={jawScope}
          onChange={(e) => {
            setJawScope(e.target.value as JawScope);
            setMessage(null);
          }}
        >
          <option value="UPPER">Верхняя (ВЧ)</option>
          <option value="LOWER">Нижняя (НЧ)</option>
        </select>
      </div>

      <p className="mb-4 text-xs text-gray-500">
        На выбранной челюсти сохранено окон: {savedOnJaw}
        {pendingOnJaw > 0 ? ` · ожидают сохранения: ${pendingOnJaw}` : ''}. Остальные позиции можно
        оставить пустыми.
      </p>

      <div className="grid grid-cols-2 gap-4 overflow-x-auto">
        {sectors.map((sector) => (
          <div key={sector.id} className="min-w-0 rounded border border-border bg-surface-muted/30 p-3">
            <h3 className="mb-3 text-sm font-semibold text-graphite">{sector.title}</h3>
            <div className="grid grid-cols-8 gap-1.5">
              {sector.teeth.map((tooth) => {
                    const implant = byTooth.get(tooth);
                    const busy = busyTooth === tooth;
                    const filled = Boolean(implant && hasConfirmedSlice(implant));
                    const staged = pendingByTooth[tooth];
                    return (
                      <div
                        key={tooth}
                        className={`rounded border p-1.5 transition-colors ${
                          staged
                            ? 'border-accent/50 bg-accent-light/40'
                            : filled
                              ? 'border-status-success/40 bg-white'
                              : 'border-dashed border-border bg-white/70'
                        }`}
                        onDragEnter={preventBrowserFileNavigation}
                        onDragOver={preventBrowserFileNavigation}
                        onDrop={(e) => {
                          preventBrowserFileNavigation(e);
                          if (inputsDisabled) return;
                          stageFileForTooth(tooth, e.dataTransfer.files?.[0] ?? null);
                        }}
                      >
                        <div className="mb-1 text-center font-mono text-sm font-semibold">
                          {tooth}
                        </div>
                        <label
                          className="block cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="sr-only">JPG для зуба {tooth}</span>
                          <input
                            type="file"
                            className="block w-full text-[10px] file:mr-1 file:rounded file:border-0 file:bg-surface-muted file:px-1.5 file:py-1 file:text-[10px]"
                            disabled={inputsDisabled}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              const selected = e.target.files?.[0] ?? null;
                              e.target.value = '';
                              stageFileForTooth(tooth, selected);
                            }}
                          />
                        </label>

                        {busy ? (
                          <p className="mt-1 text-center text-[10px] text-gray-500">Сохранение…</p>
                        ) : staged ? (
                          <p
                            className="mt-1 truncate text-center text-[10px] text-accent"
                            title={staged.name}
                          >
                            К сохранению
                          </p>
                        ) : filled ? (
                          <p className="mt-1 text-center text-[10px] text-status-success">
                            Зуб {tooth}
                          </p>
                        ) : (
                          <p className="mt-1 text-center text-[10px] text-gray-400">
                            пусто / drop JPG
                          </p>
                        )}

                        {staged ? (
                          <button
                            type="button"
                            className="btn-secondary mt-2 w-full !px-1 !py-0.5 text-[10px]"
                            disabled={inputsDisabled}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              unstageTooth(tooth);
                            }}
                          >
                            Убрать из очереди
                          </button>
                        ) : implant && canDelete ? (
                          <button
                            type="button"
                            className="btn-secondary mt-2 w-full !px-1 !py-0.5 text-[10px]"
                            disabled={inputsDisabled || busyTooth !== null}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleClearTooth(implant);
                            }}
                          >
                            Очистить
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
            </div>
          </div>
        ))}
      </div>

      {progress !== null && saving ? (
        <div className="mt-4 max-w-xs">
          <div className="mb-1 text-xs text-gray-600">Сохранение срезов: {progress}%</div>
          <div className="h-2 overflow-hidden rounded bg-surface-muted">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {!externalSaveControl && !readOnly ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={saving || pendingCount === 0}
            onClick={() => {
              void savePending().catch(() => undefined);
            }}
          >
            {saving ? 'Сохранение…' : `Сохранить срезы (${pendingCount})`}
          </button>
          {pendingCount > 0 && !saving ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPendingByTooth({})}
            >
              Очистить очередь
            </button>
          ) : null}
        </div>
      ) : pendingCount > 0 ? (
        <p className="mt-4 text-xs text-gray-600">
          В очереди срезов: {pendingCount}. Сохранение — кнопкой «Сохранить выбранные» ниже.
        </p>
      ) : null}
    </section>
  );
});
