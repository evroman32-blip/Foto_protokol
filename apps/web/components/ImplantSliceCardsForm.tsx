'use client';

import { useEffect, useMemo, useState } from 'react';

import { radiologyApi, uploadApi, type SurgicalImplantDto } from '@/lib/api';

type JawScope = 'UPPER' | 'LOWER';

type SectorDef = {
  id: number;
  title: string;
  rows: string[][];
};

/** Порядок зубов Strategic Implant®: от 18 к 48 по секторам */
export const FDI_TOOTH_ORDER = [
  '18', '17', '16', '15', '14', '13', '12', '11',
  '28', '27', '26', '25', '24', '23', '22', '21',
  '38', '37', '36', '35', '34', '33', '32', '31',
  '48', '47', '46', '45', '44', '43', '42', '41',
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
    rows: [
      ['18', '17', '16', '15'],
      ['14', '13', '12', '11'],
    ],
  },
  {
    id: 2,
    title: 'Сектор 2',
    rows: [
      ['28', '27', '26', '25'],
      ['24', '23', '22', '21'],
    ],
  },
];

const LOWER_SECTORS: SectorDef[] = [
  {
    id: 3,
    title: 'Сектор 3',
    rows: [
      ['38', '37', '36', '35'],
      ['34', '33', '32', '31'],
    ],
  },
  {
    id: 4,
    title: 'Сектор 4',
    rows: [
      ['48', '47', '46', '45'],
      ['44', '43', '42', '41'],
    ],
  },
];

function attachmentsOf(implant: SurgicalImplantDto) {
  return implant.radiologyAttachments ?? implant.attachments ?? [];
}

function hasConfirmedSlice(implant: SurgicalImplantDto) {
  return attachmentsOf(implant).some((a) => a.surgeonConfirmed);
}

export function ImplantSliceCardsForm({
  stageId,
  onChanged,
}: {
  stageId: string;
  onChanged?: () => void;
}) {
  const [implants, setImplants] = useState<SurgicalImplantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyTooth, setBusyTooth] = useState<string | null>(null);
  const [jawScope, setJawScope] = useState<JawScope>('UPPER');

  const sectors = jawScope === 'UPPER' ? UPPER_SECTORS : LOWER_SECTORS;

  const byTooth = useMemo(() => {
    const map = new Map<string, SurgicalImplantDto>();
    for (const implant of implants) {
      if (implant.toothPositionFdi) map.set(implant.toothPositionFdi, implant);
    }
    return map;
  }, [implants]);

  const filledOnJaw = implants.filter((i) => i.jawScope === jawScope).length;

  async function load(opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      setImplants(await radiologyApi.implants(stageId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки карточек');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [stageId]);

  async function uploadJpg(file: File): Promise<string> {
    const { batchId } = await uploadApi.createBatch(stageId);
    const presign = await uploadApi.presign(batchId, {
      filename: file.name,
      mimeType: file.type || 'image/jpeg',
      size: file.size,
    });
    await uploadApi.uploadFile(presign, file);
    const asset = await uploadApi.completeFile(batchId, {
      uploadId: presign.uploadId,
      objectKey: presign.objectKey,
      originalFileName: file.name,
      mimeType: file.type || 'image/jpeg',
      fileSizeBytes: file.size,
    });
    await uploadApi.completeBatch(batchId);
    const mediaId = asset.id ?? asset.mediaAssetId;
    if (!mediaId) throw new Error('Не получен id файла после загрузки');
    return mediaId;
  }

  async function handleFileForTooth(tooth: string, file: File | null) {
    if (!file) return;
    setBusyTooth(tooth);
    setError(null);
    setMessage(null);
    try {
      if (!/\.jpe?g$/i.test(file.name) && file.type !== 'image/jpeg') {
        throw new Error('Срез должен быть в формате JPG');
      }

      let implant = byTooth.get(tooth);
      if (!implant) {
        const implantNumber = Number(tooth);
        implant = await radiologyApi.createImplant(stageId, {
          implantNumber: Number.isFinite(implantNumber) ? implantNumber : fdiSortRank(tooth) + 1,
          jawScope,
          toothPositionFdi: tooth,
          implantLabel: `Зуб ${tooth}`,
        });
      }

      const mediaAssetId = await uploadJpg(file);
      await radiologyApi.attachSlice(implant.id, {
        mediaAssetId,
        attachmentType: 'CT_CROSS_SECTION',
        surgeonConfirmed: true,
      });

      setMessage(`JPG для зуба ${tooth} сохранён`);
      await load({ silent: true });
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить срез');
    } finally {
      setBusyTooth(null);
    }
  }

  async function handleClearTooth(implant: SurgicalImplantDto) {
    const tooth = implant.toothPositionFdi ?? '';
    if (!window.confirm(`Удалить срез зуба ${tooth || implant.implantNumber}?`)) return;
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

  return (
    <section className="card mb-6">
      <h2 className="mb-1 font-semibold text-graphite">
        3. Карточки срезов имплантатов
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        Выберите челюсть и загрузите JPG-срезы в окна зубов. Пустые окна допустимы. Вид и метод
        установки на этом этапе необязательны.
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
        На выбранной челюсти заполнено окон: {filledOnJaw}. Остальные позиции можно оставить
        пустыми.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {sectors.map((sector) => (
          <div key={sector.id} className="rounded border border-border bg-surface-muted/30 p-3">
            <h3 className="mb-3 text-sm font-semibold text-graphite">{sector.title}</h3>
            <div className="grid gap-3">
              {sector.rows.map((row) => (
                <div key={row.join('-')} className="grid grid-cols-4 gap-2">
                  {row.map((tooth) => {
                    const implant = byTooth.get(tooth);
                    const busy = busyTooth === tooth;
                    const filled = Boolean(implant && hasConfirmedSlice(implant));
                    return (
                      <div
                        key={tooth}
                        className={`rounded border p-2 ${
                          filled
                            ? 'border-status-success/40 bg-white'
                            : 'border-dashed border-border bg-white/70'
                        }`}
                      >
                        <div className="mb-1 text-center font-mono text-sm font-semibold">
                          {tooth}
                        </div>
                        <label className="block cursor-pointer">
                          <span className="sr-only">JPG для зуба {tooth}</span>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,image/jpeg"
                            className="block w-full text-[10px] file:mr-1 file:rounded file:border-0 file:bg-surface-muted file:px-1.5 file:py-1 file:text-[10px]"
                            disabled={busy || busyTooth !== null}
                            onChange={(e) => {
                              const selected = e.target.files?.[0] ?? null;
                              e.target.value = '';
                              void handleFileForTooth(tooth, selected);
                            }}
                          />
                        </label>
                        {busy ? (
                          <p className="mt-1 text-center text-[10px] text-gray-500">Сохранение…</p>
                        ) : filled ? (
                          <p className="mt-1 text-center text-[10px] text-status-success">
                            Зуб {tooth}
                          </p>
                        ) : (
                          <p className="mt-1 text-center text-[10px] text-gray-400">пусто</p>
                        )}
                        {implant ? (
                          <button
                            type="button"
                            className="btn-secondary mt-2 w-full !px-1 !py-0.5 text-[10px]"
                            disabled={busyTooth !== null}
                            onClick={() => void handleClearTooth(implant)}
                          >
                            Очистить
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
