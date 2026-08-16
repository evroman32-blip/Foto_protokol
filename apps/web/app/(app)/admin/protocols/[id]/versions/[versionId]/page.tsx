'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import {
  adminApi,
  type MediaRequirementAdminDto,
  type ProtocolVersionDto,
  type StageTemplateAdminDto,
} from '@/lib/api';
import { confirmDelete } from '@/lib/confirm-delete';
import { mergePositionNameCatalog } from '@/lib/position-names';
import { useCurrentUser } from '@/lib/use-current-user';
import { SearchableTextSelect } from '@/components/SearchableTextSelect';

const MEDIA_TYPES = [
  { value: 'PHOTO', label: 'Фото' },
  { value: 'VIDEO', label: 'Видео' },
  { value: 'DOCUMENT', label: 'Документ' },
  { value: 'STL', label: 'STL (3D-модель)' },
  { value: 'RADIOLOGY_IMAGE', label: 'Рентген-изображение' },
];

type LocalRequirement = {
  key: string;
  existingId?: string;
  code: string;
  name: string;
  instruction: string;
  mediaType: string;
  minCount: number;
  sortOrder: number;
  required: boolean;
  isActive: boolean;
  dirty?: boolean;
};

function emptyLocal(sortOrder = 1): LocalRequirement {
  return {
    key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: '',
    name: '',
    instruction: '',
    mediaType: 'PHOTO',
    minCount: 1,
    sortOrder,
    required: true,
    isActive: true,
    dirty: true,
  };
}

function fromServer(req: MediaRequirementAdminDto): LocalRequirement {
  return {
    key: req.id,
    existingId: req.id,
    code: req.code,
    name: req.name,
    instruction: req.instruction ?? '',
    mediaType: req.mediaType,
    minCount: req.minCount,
    sortOrder: req.sortOrder,
    required: req.required,
    isActive: req.isActive !== false,
    dirty: false,
  };
}

function isRemovedCtDicomRequirement(req: {
  code?: string;
  name?: string;
  mediaType?: string;
}) {
  const code = (req.code ?? '').toUpperCase();
  const name = req.name ?? '';
  const mediaType = req.mediaType ?? '';
  return (
    mediaType === 'RADIOLOGY_STUDY' ||
    mediaType === 'DICOM_SERIES' ||
    code === 'POSTOP_CBCT_STUDY' ||
    code === 'POSTOP_IMPLANT_CT_SLICES' ||
    code.includes('CBCT') ||
    code.includes('DICOM') ||
    name.includes('КЛКТ') ||
    name.includes('КТ-срезы') ||
    name.includes('DICOM')
  );
}

function mediaTypeLabel(value: string) {
  return MEDIA_TYPES.find((t) => t.value === value)?.label ?? value;
}

function slugifyCode(name: string) {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
    й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
    э: 'e', ю: 'yu', я: 'ya',
  };
  return name
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase()
    .slice(0, 96);
}

/** Уникальный код среди уже занятых (защита от коллизий длинных названий). */
function ensureUniqueCode(raw: string, used: Set<string>, fallbackPrefix = 'REQ') {
  let base = (raw || fallbackPrefix).toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
  if (!base) base = fallbackPrefix;
  base = base.slice(0, 96);
  if (!used.has(base)) return base;
  // хвост хеша от полного raw, чтобы длинные похожие названия не сталкивались
  let n = 2;
  let candidate = `${base.slice(0, 90)}_${n}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${base.slice(0, 90)}_${n}`;
  }
  return candidate;
}

function RequirementFields({
  value,
  onChange,
  codeEditable,
  nameCatalog,
}: {
  value: LocalRequirement;
  onChange: (patch: Partial<LocalRequirement>) => void;
  codeEditable: boolean;
  nameCatalog: string[];
}) {
  const instruction = value.instruction ?? '';

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label-field">Название положения</label>
          <SearchableTextSelect
            value={value.name}
            options={nameCatalog}
            placeholder="Начните вводить название"
            onChange={(name) =>
              onChange({
                name,
                dirty: true,
                code: codeEditable ? slugifyCode(name) : value.code,
              })
            }
          />
        </div>
        <div>
          <label className="label-field">Тип</label>
          <select
            className="input-field"
            value={value.mediaType}
            onChange={(e) => onChange({ mediaType: e.target.value, dirty: true })}
          >
            {MEDIA_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Мин. кол-во</label>
          <input
            type="number"
            min={0}
            className="input-field"
            value={value.minCount}
            onChange={(e) => onChange({ minCount: Number(e.target.value), dirty: true })}
          />
        </div>
      </div>

      <div>
        <label className="label-field" htmlFor={`req-instruction-${value.key}`}>
          Описание положения
        </label>
        <textarea
          id={`req-instruction-${value.key}`}
          className="input-field min-h-[100px] w-full resize-y"
          value={instruction}
          placeholder="Инструкция для врача при загрузке: ракурс, свет, положение губ, шаблоны…"
          rows={4}
          onChange={(e) => onChange({ instruction: e.target.value, dirty: true })}
        />
        <p className="mt-1 text-xs text-gray-500">
          Этот текст отображается в окне загрузки медиа как инструкция к положению.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label-field">Код</label>
          <input
            className="input-field font-mono text-xs"
            value={value.code}
            placeholder="PREOP_FACE_FRONT_REST"
            disabled={!codeEditable}
            onChange={(e) =>
              onChange({
                code: e.target.value.toUpperCase().replace(/\s+/g, '_'),
                dirty: true,
              })
            }
          />
        </div>
        <div>
          <label className="label-field">Порядок</label>
          <input
            type="number"
            className="input-field"
            value={value.sortOrder}
            onChange={(e) => onChange({ sortOrder: Number(e.target.value), dirty: true })}
          />
        </div>
        <div className="flex items-end gap-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.required}
              onChange={(e) => onChange({ required: e.target.checked, dirty: true })}
            />
            Обязательно
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.isActive}
              onChange={(e) => onChange({ isActive: e.target.checked, dirty: true })}
            />
            Активно
          </label>
        </div>
      </div>
    </div>
  );
}

export default function ProtocolVersionPage() {
  const { id: protocolId, versionId } = useParams<{ id: string; versionId: string }>();
  const { canDelete } = useCurrentUser();
  const [version, setVersion] = useState<ProtocolVersionDto | null>(null);
  const [templates, setTemplates] = useState<StageTemplateAdminDto[]>([]);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [stageName, setStageName] = useState('');
  const [stageSortOrder, setStageSortOrder] = useState(0);
  const [items, setItems] = useState<LocalRequirement[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showList, setShowList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const editRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const v = await adminApi.protocolVersion(protocolId, versionId);
        setVersion(v);
        setTemplates(v.stageTemplates ?? []);
        return v;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
        return null;
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [protocolId, versionId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function hydrateStage(template: StageTemplateAdminDto) {
    const saved = [...(template.mediaRequirements ?? [])]
      .filter((r) => !isRemovedCtDicomRequirement(r))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(fromServer);
    setItems(saved.length ? saved : [emptyLocal(1)]);
    setEditingKey(null);
    setStageName(template.name);
    setStageSortOrder(template.sortOrder);
    setShowList(true);
  }

  function openStage(template: StageTemplateAdminDto) {
    if (activeStageId === template.id) {
      setActiveStageId(null);
      setEditingKey(null);
      return;
    }
    setActiveStageId(template.id);
    hydrateStage(template);
    setError(null);
    setMessage(null);
  }

  async function addNewStage() {
    if (!versionId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const usedCodes = new Set(templates.map((t) => t.code.toUpperCase()));
      let n = templates.length + 1;
      let code = `NEW_STAGE_${n}`;
      while (usedCodes.has(code)) {
        n += 1;
        code = `NEW_STAGE_${n}`;
      }
      const nextOrder = Math.max(0, ...templates.map((t) => t.sortOrder), 0) + 1;
      const created = await adminApi.createStageTemplate({
        protocolVersionId: versionId,
        name: 'Новый этап',
        code,
        sortOrder: nextOrder,
        ownerRole: 'ORTHOPEDIST',
      });
      const refreshed = await load({ silent: true });
      const stage = refreshed?.stageTemplates?.find((t) => t.id === created.id);
      if (stage) {
        setActiveStageId(stage.id);
        hydrateStage(stage);
      }
      setMessage('Этап создан. Заполните название, положения и нажмите «Сохранить».');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать этап');
    } finally {
      setSaving(false);
    }
  }

  async function deleteStage(template: StageTemplateAdminDto, e: MouseEvent) {
    e.stopPropagation();
    if (!canDelete) return;
    if (
      !(await confirmDelete(
        `Удалить этап «${template.name}» (${template.code}) из протокола?\nПоложения этапа тоже будут удалены. Если в случаях уже есть файлы по этапу — удаление будет отклонено.`,
      ))
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminApi.deleteStageTemplate(template.id);
      if (activeStageId === template.id) {
        setActiveStageId(null);
        setEditingKey(null);
      }
      await load({ silent: true });
      setMessage(`Этап «${template.name}» удалён`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить этап');
    } finally {
      setSaving(false);
    }
  }

  const activeTemplate = templates.find((t) => t.id === activeStageId) ?? null;
  const existingItems = items.filter((i) => i.existingId);
  const newItems = items.filter((i) => !i.existingId);
  const positionNameCatalog = useMemo(
    () => mergePositionNameCatalog(items.map((item) => item.name)),
    [items],
  );

  function patchItem(key: string, patch: Partial<LocalRequirement>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function addItem() {
    const nextOrder = Math.max(0, ...items.map((i) => i.sortOrder)) + 1;
    const draft = emptyLocal(nextOrder);
    const used = new Set(
      items.map((i) => (i.code || '').toUpperCase()).filter(Boolean),
    );
    draft.code = ensureUniqueCode(`POS_${nextOrder}`, used, 'POS');
    setItems((prev) => [...prev, draft]);
    setEditingKey(draft.key);
    setShowList(true);
    requestAnimationFrame(() => editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  function removeNewItem(key: string) {
    setItems((prev) => {
      const next = prev.filter((i) => i.key !== key);
      return next.length ? next : [emptyLocal(1)];
    });
    if (editingKey === key) setEditingKey(null);
  }

  async function removeItem(item: LocalRequirement) {
    if (!item.existingId) {
      removeNewItem(item.key);
      return;
    }
    if (item.existingId && !canDelete) return;
    if (!(await confirmDelete(`Удалить положение «${item.name || item.code}» из шаблона?`))) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminApi.deleteMediaRequirement(item.existingId);
      setItems((prev) => prev.filter((i) => i.key !== item.key));
      if (editingKey === item.key) setEditingKey(null);
      setMessage('Положение удалено из шаблона');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить положение');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(key: string) {
    setEditingKey((prev) => (prev === key ? null : key));
    setShowList(true);
    requestAnimationFrame(() => editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  async function saveAll() {
    if (!activeTemplate) return;

    const usedCodes = new Set<string>();
    for (const i of existingItems) {
      const c = i.code.trim().toUpperCase().replace(/\s+/g, '_');
      if (c) usedCodes.add(c);
    }

    const toCreate = newItems
      .map((i) => {
        const name = i.name.trim();
        const rawCode = (i.code.trim() || slugifyCode(name)).toUpperCase().replace(/\s+/g, '_');
        const code = ensureUniqueCode(rawCode || slugifyCode(name) || `POS_${i.sortOrder}`, usedCodes);
        usedCodes.add(code);
        return { ...i, name, code };
      })
      .filter((i) => i.name || i.code);

    for (const i of toCreate) {
      if (!i.name || !i.code) {
        setError('У новых положений заполните название и код');
        return;
      }
    }

    const toUpdate = existingItems.filter((i) => i.dirty);

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (stageName !== activeTemplate.name || stageSortOrder !== activeTemplate.sortOrder) {
        await adminApi.updateStageTemplate(activeTemplate.id, {
          name: stageName.trim() || activeTemplate.name,
          sortOrder: stageSortOrder,
        });
      }

      for (const item of toUpdate) {
        await adminApi.updateMediaRequirement(item.existingId!, {
          name: item.name.trim(),
          mediaType: item.mediaType,
          minCount: item.minCount,
          sortOrder: item.sortOrder,
          required: item.required,
          isActive: item.isActive,
          instruction: item.instruction.trim() || null,
        });
      }

      for (const item of toCreate) {
        await adminApi.createMediaRequirement({
          stageTemplateId: activeTemplate.id,
          code: item.code,
          name: item.name,
          mediaType: item.mediaType,
          minCount: item.minCount,
          sortOrder: item.sortOrder,
          required: item.required,
          instruction: item.instruction.trim() || undefined,
        });
      }

      const refreshed = await load({ silent: true });
      const stage = refreshed?.stageTemplates?.find((t) => t.id === activeTemplate.id);
      if (stage) {
        setActiveStageId(stage.id);
        hydrateStage(stage);
      }
      setMessage('Все изменения сохранены в протокол');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title={version?.protocolName ?? 'Протокол'}
        description={`Версия ${version?.version ?? ''} · статус ${version?.status ?? ''} · активные положения шаблона сразу видны в загрузке открытых случаев; закрытые случаи не меняются`}
        actions={
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <Link href="/admin/protocols" className="btn-secondary w-full text-center sm:w-auto">
              К списку протоколов
            </Link>
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              disabled={saving}
              onClick={() => void addNewStage()}
            >
              Добавить новый этап
            </button>
          </div>
        }
      />

      {error ? <div className="alert-error mb-4">{error}</div> : null}
      {message ? <div className="mb-4 text-sm text-status-success">{message}</div> : null}

      <div className="space-y-3">
        {templates.map((template) => {
          const open = activeStageId === template.id;
          const activeCount =
            (open ? items : template.mediaRequirements ?? []).filter((r) =>
              'isActive' in r ? r.isActive !== false : true,
            ).length;

          return (
            <div key={template.id} className="card space-y-4">
              <div className="flex w-full items-center justify-between gap-3 text-left">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => openStage(template)}
                >
                  <div className="font-medium">
                    {template.sortOrder}. {template.name}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {template.code} · положений: {activeCount}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="text-sm text-accent underline-offset-2 hover:underline"
                    onClick={() => openStage(template)}
                  >
                    {open ? 'Свернуть' : 'Настроить этап'}
                  </button>
                  {canDelete ? (
                  <button
                    type="button"
                    className="btn-secondary !px-2 !py-1 text-xs text-status-danger"
                    disabled={saving}
                    onClick={(e) => void deleteStage(template, e)}
                  >
                    Удалить
                  </button>
                  ) : null}
                </div>
              </div>

              {open && activeTemplate?.id === template.id ? (
                <div className="space-y-5 border-t border-border pt-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label-field">Название этапа</label>
                      <input
                        className="input-field"
                        value={stageName}
                        onChange={(e) => setStageName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label-field">Порядок этапа</label>
                      <input
                        type="number"
                        className="input-field"
                        value={stageSortOrder}
                        onChange={(e) => setStageSortOrder(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium">
                        Положения в протоколе
                        <span className="ml-2 font-normal text-gray-500">({items.length})</span>
                      </h3>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="text-sm text-accent underline-offset-2 hover:underline"
                          onClick={() => setShowList((v) => !v)}
                        >
                          {showList ? 'Скрыть список' : 'Показать список'}
                        </button>
                        <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={addItem}>
                          Создать
                        </button>
                      </div>
                    </div>

                    {showList ? (
                      <ul className="divide-y divide-border rounded border border-border">
                        {items.map((item) => {
                          const isEditing = editingKey === item.key;
                          return (
                            <li key={item.key} className="px-3 py-2">
                              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  <label className="flex shrink-0 cursor-pointer items-center gap-2">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4"
                                      checked={item.isActive}
                                      onChange={(e) =>
                                        patchItem(item.key, {
                                          isActive: e.target.checked,
                                          dirty: true,
                                        })
                                      }
                                    />
                                    <span className="text-xs text-gray-500">Активно</span>
                                  </label>
                                  <div className={`min-w-0 ${item.isActive ? '' : 'opacity-50'}`}>
                                    <span className="font-medium">
                                      {item.name || 'Новое положение'}
                                    </span>
                                    <span className="ml-2 text-xs text-gray-500">
                                      {mediaTypeLabel(item.mediaType)}
                                      {item.code ? ` · ${item.code}` : ''}
                                      {!item.existingId ? ' · новое' : item.dirty ? ' · изменено' : ''}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                  <button
                                    type="button"
                                    className="btn-secondary !px-2 !py-1 text-xs"
                                    onClick={() => startEdit(item.key)}
                                  >
                                    {isEditing ? 'Закрыть' : 'Изменить'}
                                  </button>
                                  {canDelete || !item.existingId ? (
                                  <button
                                    type="button"
                                    className="btn-secondary !px-2 !py-1 text-xs text-status-danger"
                                    disabled={saving}
                                    onClick={() => void removeItem(item)}
                                  >
                                    Удалить
                                  </button>
                                  ) : null}
                                </div>
                              </div>

                              {isEditing ? (
                                <div
                                  ref={editRef}
                                  className="mt-3 rounded border border-accent/30 bg-surface-muted/40 p-3"
                                >
                                  <div className="mb-3 text-xs font-medium text-graphite">
                                    {item.existingId
                                      ? 'Настройка положения'
                                      : 'Новое положение'}
                                  </div>
                                  <RequirementFields
                                    value={item}
                                    codeEditable={!item.existingId}
                                    nameCatalog={positionNameCatalog}
                                    onChange={(patch) => patchItem(item.key, patch)}
                                  />
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Список скрыт. Откройте его, чтобы править положения, или нажмите «Создать».
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 border-t border-border pt-4">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={saving}
                      onClick={() => void saveAll()}
                    >
                      {saving ? 'Сохранение…' : 'Сохранить'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={addItem} disabled={saving}>
                      Создать
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
