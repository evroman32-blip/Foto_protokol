'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  radiologyApi,
  uploadApi,
  type ImplantMethodDto,
  type ImplantTypeDto,
  type SurgicalImplantDto,
} from '@/lib/api';

const UPPER_TEETH = ['11', '12', '13', '14', '15', '16', '17', '18', '21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_TEETH = ['31', '32', '33', '34', '35', '36', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48'];

type DraftCard = {
  jawScope: 'UPPER' | 'LOWER';
  toothPositionFdi: string;
  implantTypeId: string;
  actualMethodCode: string;
  file: File | null;
};

const emptyDraft = (): DraftCard => ({
  jawScope: 'UPPER',
  toothPositionFdi: '',
  implantTypeId: '',
  actualMethodCode: '',
  file: null,
});

function attachmentsOf(implant: SurgicalImplantDto) {
  return implant.radiologyAttachments ?? implant.attachments ?? [];
}

export function ImplantSliceCardsForm({ stageId }: { stageId: string }) {
  const [implants, setImplants] = useState<SurgicalImplantDto[]>([]);
  const [methods, setMethods] = useState<ImplantMethodDto[]>([]);
  const [types, setTypes] = useState<ImplantTypeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DraftCard>(emptyDraft);

  const teeth = draft.jawScope === 'UPPER' ? UPPER_TEETH : LOWER_TEETH;
  const filteredMethods = useMemo(
    () => methods.filter((m) => m.jawScope === 'BOTH' || m.jawScope === draft.jawScope),
    [methods, draft.jawScope],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [implantsData, methodsData, typesData] = await Promise.all([
        radiologyApi.implants(stageId),
        radiologyApi.implantMethods(),
        radiologyApi.implantTypes(),
      ]);
      setImplants(implantsData);
      setMethods(methodsData);
      setTypes(typesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки карточек');
    } finally {
      setLoading(false);
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

  async function handleAddCard() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!draft.toothPositionFdi) throw new Error('Укажите номер зуба');
      if (!draft.implantTypeId) throw new Error('Выберите вид имплантата');
      if (!draft.actualMethodCode) throw new Error('Выберите метод установки');
      if (!draft.file) throw new Error('Прикрепите JPG-срез имплантата');
      if (!/\.jpe?g$/i.test(draft.file.name) && draft.file.type !== 'image/jpeg') {
        throw new Error('Срез должен быть в формате JPG');
      }

      const nextNumber =
        implants.reduce((max, i) => Math.max(max, Number(i.implantNumber) || 0), 0) + 1;

      const created = await radiologyApi.createImplant(stageId, {
        implantNumber: nextNumber,
        jawScope: draft.jawScope,
        toothPositionFdi: draft.toothPositionFdi,
        implantTypeId: draft.implantTypeId,
        actualMethodCode: draft.actualMethodCode,
        implantLabel: `Зуб ${draft.toothPositionFdi}`,
      });

      const mediaAssetId = await uploadJpg(draft.file);
      await radiologyApi.attachSlice(created.id, {
        mediaAssetId,
        attachmentType: 'CT_CROSS_SECTION',
        surgeonConfirmed: true,
      });

      setDraft(emptyDraft());
      setMessage('Карточка имплантата сохранена');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить карточку');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Удалить карточку имплантата?')) return;
    setBusy(true);
    try {
      await radiologyApi.deleteImplant(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Загрузка карточек имплантатов…</p>;
  }

  return (
    <section className="card mb-6">
      <h2 className="mb-1 font-semibold text-graphite">Карточки срезов имплантатов</h2>
      <p className="mb-4 text-sm text-gray-600">
        На каждый имплантат: челюсть, номер зуба, вид, метод и JPG-скриншот среза с экрана КТ.
      </p>

      {error ? <div className="alert-error mb-3">{error}</div> : null}
      {message ? <div className="mb-3 text-sm text-status-success">{message}</div> : null}

      <div className="mb-4 grid gap-3 rounded border border-border bg-surface-muted/40 p-3 sm:grid-cols-2">
        <div>
          <label className="label-field">Челюсть</label>
          <select
            className="input-field"
            value={draft.jawScope}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                jawScope: e.target.value as 'UPPER' | 'LOWER',
                toothPositionFdi: '',
              }))
            }
          >
            <option value="UPPER">Верхняя</option>
            <option value="LOWER">Нижняя</option>
          </select>
        </div>
        <div>
          <label className="label-field">Номер зуба (FDI)</label>
          <select
            className="input-field"
            value={draft.toothPositionFdi}
            onChange={(e) => setDraft((d) => ({ ...d, toothPositionFdi: e.target.value }))}
          >
            <option value="">Выберите…</option>
            {teeth.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Вид имплантата</label>
          <select
            className="input-field"
            value={draft.implantTypeId}
            onChange={(e) => setDraft((d) => ({ ...d, implantTypeId: e.target.value }))}
          >
            <option value="">Выберите…</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nameRu}
                {t.brand ? ` · ${t.brand}` : ''}
              </option>
            ))}
          </select>
          {!types.length ? (
            <p className="mt-1 text-xs text-status-warning">
              Справочник пуст — заполните в Админ → Виды имплантатов
            </p>
          ) : null}
        </div>
        <div>
          <label className="label-field">Метод установки</label>
          <select
            className="input-field"
            value={draft.actualMethodCode}
            onChange={(e) => setDraft((d) => ({ ...d, actualMethodCode: e.target.value }))}
          >
            <option value="">Выберите…</option>
                {filteredMethods.map((m) => (
                  <option key={m.id} value={m.code}>
                    {m.code} · {m.nameRu}
                  </option>
                ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label-field">JPG-срез имплантата (скриншот с КТ)</label>
          <input
            type="file"
            accept=".jpg,.jpeg,image/jpeg"
            className="input-field"
            onChange={(e) => setDraft((d) => ({ ...d, file: e.target.files?.[0] ?? null }))}
          />
          {draft.file ? <p className="mt-1 text-xs text-gray-500">{draft.file.name}</p> : null}
        </div>
        <div className="sm:col-span-2">
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void handleAddCard()}
          >
            {busy ? 'Сохранение…' : 'Добавить карточку имплантата'}
          </button>
        </div>
      </div>

      {implants.length ? (
        <ul className="divide-y divide-border rounded border border-border">
          {implants.map((i) => {
            const slices = attachmentsOf(i);
            return (
              <li
                key={i.id}
                className="flex flex-wrap items-start justify-between gap-3 px-3 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    #{i.implantNumber} · {i.implantLabel || `Зуб ${i.toothPositionFdi ?? '—'}`}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {i.jawScope === 'UPPER'
                      ? 'Верхняя'
                      : i.jawScope === 'LOWER'
                        ? 'Нижняя'
                        : i.jawScope}
                    {i.toothPositionFdi ? ` · зуб ${i.toothPositionFdi}` : ''}
                    {i.implantType
                      ? ` · ${i.implantType.nameRu}`
                      : i.implantTypeId
                        ? ' · вид выбран'
                        : ' · вид не выбран'}
                    {i.actualMethodCode ? ` · ${i.actualMethodCode}` : ' · метод не выбран'}
                    {slices.some((a) => a.surgeonConfirmed) ? ' · JPG загружен' : ' · JPG отсутствует'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary !px-2 !py-1 text-xs"
                  disabled={busy}
                  onClick={() => void handleDelete(i.id)}
                >
                  Удалить
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">Карточек пока нет — добавьте хотя бы одну.</p>
      )}
    </section>
  );
}
