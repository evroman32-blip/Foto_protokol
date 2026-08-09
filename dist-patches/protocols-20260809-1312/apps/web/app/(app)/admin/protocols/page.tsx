'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { adminApi, type ProtocolAdminDto } from '@/lib/api';

type EditDraft = {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  versionId: string;
  version: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
};

function slugifyProtocolCode(name: string) {
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
    .slice(0, 64);
}

function primaryVersion(p: ProtocolAdminDto) {
  return (
    p.versions.find((v) => v.status === 'PUBLISHED') ??
    p.versions[0] ??
    null
  );
}

export default function AdminProtocolsPage() {
  const [protocols, setProtocols] = useState<ProtocolAdminDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0');
  const [publishNow, setPublishNow] = useState(true);
  const [codeTouched, setCodeTouched] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setProtocols(await adminApi.protocols());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await adminApi.createProtocol({
        code: code.trim() || slugifyProtocolCode(name),
        name: name.trim(),
        description: description.trim() || undefined,
        version: version.trim() || '1.0',
        status: publishNow ? 'PUBLISHED' : 'DRAFT',
      });
      setCode('');
      setName('');
      setDescription('');
      setVersion('1.0');
      setPublishNow(true);
      setCodeTouched(false);
      const v = primaryVersion(created);
      setMessage(
        v
          ? `Протокол создан. Дальше настройте этапы и положения.`
          : 'Протокол создан',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать протокол');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: ProtocolAdminDto) {
    const v = primaryVersion(p);
    setEditingId(p.id);
    setDraft({
      code: p.code,
      name: p.name,
      description: p.description ?? '',
      isActive: p.isActive,
      versionId: v?.id ?? '',
      version: v?.version ?? '1.0',
      status: (v?.status as EditDraft['status']) ?? 'DRAFT',
    });
    setMessage(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveEdit(id: string) {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await adminApi.updateProtocol(id, {
        code: draft.code.trim(),
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        isActive: draft.isActive,
      });
      if (draft.versionId) {
        await adminApi.updateProtocolVersion(draft.versionId, {
          version: draft.version.trim(),
          status: draft.status,
        });
      }
      setMessage('Протокол сохранён');
      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Протоколы"
        description="Справочник протоколов: создание, редактирование и настройка этапов"
      />
      {error ? <div className="alert-error mb-4">{error}</div> : null}
      {message ? <div className="mb-4 text-sm text-status-success">{message}</div> : null}

      <div className="card mb-4 space-y-3">
        <div className="text-sm font-medium text-graphite">Новый протокол</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label-field">Название</label>
            <input
              className="input-field"
              value={name}
              placeholder="Strategic Implant PhotoProtocol"
              onChange={(e) => {
                const next = e.target.value;
                setName(next);
                if (!codeTouched) setCode(slugifyProtocolCode(next));
              }}
            />
          </div>
          <div>
            <label className="label-field">Код</label>
            <input
              className="input-field font-mono text-xs"
              value={code}
              placeholder="STRATEGIC_IMPLANT_V1"
              onChange={(e) => {
                setCodeTouched(true);
                setCode(e.target.value.toUpperCase().replace(/\s+/g, '_'));
              }}
            />
          </div>
          <div>
            <label className="label-field">Версия</label>
            <input
              className="input-field"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label-field">Описание</label>
            <input
              className="input-field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание протокола (необязательно)"
            />
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={publishNow}
                onChange={(e) => setPublishNow(e.target.checked)}
              />
              Опубликовать сразу
            </label>
          </div>
        </div>
        <div>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !name.trim() || !(code.trim() || name.trim())}
            onClick={() => void handleCreate()}
          >
            Создать протокол
          </button>
        </div>
      </div>

      <div className="table-wrap overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th>Протокол</th>
              <th>Код</th>
              <th>Версия</th>
              <th>Статус</th>
              <th>Активен</th>
              <th className="w-56">Действия</th>
            </tr>
          </thead>
          <tbody>
            {protocols.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-sm text-gray-500">
                  Протоколов пока нет — создайте первый выше.
                </td>
              </tr>
            ) : null}
            {protocols.map((p) => {
              const v = primaryVersion(p);
              const isEditing = editingId === p.id && draft;
              return (
                <tr key={p.id}>
                  <td className="align-top">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          className="input-field min-w-[14rem]"
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        />
                        <input
                          className="input-field text-sm"
                          value={draft.description}
                          placeholder="Описание"
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium">{p.name}</div>
                        {p.description ? (
                          <div className="mt-0.5 text-xs text-gray-500">{p.description}</div>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="align-top font-mono text-xs">
                    {isEditing ? (
                      <input
                        className="input-field font-mono text-xs"
                        value={draft.code}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            code: e.target.value.toUpperCase().replace(/\s+/g, '_'),
                          })
                        }
                      />
                    ) : (
                      p.code
                    )}
                  </td>
                  <td className="align-top">
                    {isEditing && draft.versionId ? (
                      <input
                        className="input-field w-24"
                        value={draft.version}
                        onChange={(e) => setDraft({ ...draft, version: e.target.value })}
                      />
                    ) : (
                      v?.version ?? '—'
                    )}
                  </td>
                  <td className="align-top">
                    {isEditing && draft.versionId ? (
                      <select
                        className="input-field"
                        value={draft.status}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            status: e.target.value as EditDraft['status'],
                          })
                        }
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="PUBLISHED">PUBLISHED</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                      </select>
                    ) : (
                      <span className="badge-muted">{v?.status ?? '—'}</span>
                    )}
                  </td>
                  <td className="align-top">
                    {isEditing ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                        />
                        Да
                      </label>
                    ) : p.isActive ? (
                      'Да'
                    ) : (
                      <span className="text-gray-500">Нет</span>
                    )}
                  </td>
                  <td className="align-top whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          className="btn-primary !px-2 !py-1 text-xs"
                          disabled={busy}
                          onClick={() => void saveEdit(p.id)}
                        >
                          Сохранить
                        </button>
                        <button
                          type="button"
                          className="btn-secondary !px-2 !py-1 text-xs"
                          disabled={busy}
                          onClick={cancelEdit}
                        >
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          className="text-left text-sm text-accent underline-offset-2 hover:underline"
                          onClick={() => startEdit(p)}
                        >
                          Редактировать
                        </button>
                        {v ? (
                          <Link
                            href={`/admin/protocols/${p.id}/versions/${v.id}`}
                            className="text-sm text-accent underline-offset-2 hover:underline"
                          >
                            Настроить шаблоны
                          </Link>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
