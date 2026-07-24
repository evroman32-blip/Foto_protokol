'use client';

import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { adminApi, type ImplantMethodDto } from '@/lib/api';

const JAW_LABEL: Record<string, string> = {
  BOTH: 'Обе',
  UPPER: 'Верхняя',
  LOWER: 'Нижняя',
};

type EditDraft = {
  code: string;
  nameRu: string;
  jawScope: string;
};

export default function ImplantMethodsPage() {
  const [methods, setMethods] = useState<ImplantMethodDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [nameRu, setNameRu] = useState('');
  const [jawScope, setJawScope] = useState('BOTH');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setMethods(await adminApi.implantMethods({ active: true }));
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
      await adminApi.createImplantMethod({
        code: code.trim(),
        nameRu: nameRu.trim(),
        jawScope,
      });
      setCode('');
      setNameRu('');
      setMessage('Метод добавлен');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(m: ImplantMethodDto) {
    setEditingId(m.id);
    setDraft({
      code: m.code,
      nameRu: m.nameRu,
      jawScope: m.jawScope,
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
      await adminApi.updateImplantMethod(id, {
        code: draft.code.trim(),
        nameRu: draft.nameRu.trim(),
        jawScope: draft.jawScope,
      });
      setMessage('Метод сохранён');
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
        title="Методы имплантации"
        description="Короткий код (M1A, M2, M10A), название и челюсть. Редактирование прямо в таблице."
      />
      {error ? <div className="alert-error mb-4">{error}</div> : null}
      {message ? <div className="mb-4 text-sm text-status-success">{message}</div> : null}

      <div className="card mb-4 grid gap-3 sm:grid-cols-4">
        <div>
          <label className="label-field">Код</label>
          <input
            className="input-field"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="M17"
          />
        </div>
        <div>
          <label className="label-field">Название</label>
          <input className="input-field" value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
        </div>
        <div>
          <label className="label-field">Челюсть</label>
          <select
            className="input-field"
            value={jawScope}
            onChange={(e) => setJawScope(e.target.value)}
          >
            <option value="BOTH">Обе</option>
            <option value="UPPER">Верхняя</option>
            <option value="LOWER">Нижняя</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy || !code.trim() || !nameRu.trim()}
            onClick={() => void handleCreate()}
          >
            Добавить
          </button>
        </div>
      </div>

      <div className="table-wrap overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th className="w-24">Код</th>
              <th>Название</th>
              <th className="w-36">Челюсть</th>
              <th className="w-40">Действия</th>
            </tr>
          </thead>
          <tbody>
            {methods.map((m) => {
              const isEditing = editingId === m.id && draft;
              return (
                <tr key={m.id}>
                  <td className="align-top font-mono">
                    {isEditing ? (
                      <input
                        className="input-field !w-24 font-mono"
                        value={draft.code}
                        onChange={(e) =>
                          setDraft({ ...draft, code: e.target.value.toUpperCase() })
                        }
                      />
                    ) : (
                      m.code
                    )}
                  </td>
                  <td className="align-top">
                    {isEditing ? (
                      <input
                        className="input-field min-w-[14rem]"
                        value={draft.nameRu}
                        onChange={(e) => setDraft({ ...draft, nameRu: e.target.value })}
                      />
                    ) : (
                      m.nameRu
                    )}
                  </td>
                  <td className="align-top">
                    {isEditing ? (
                      <select
                        className="input-field"
                        value={draft.jawScope}
                        onChange={(e) => setDraft({ ...draft, jawScope: e.target.value })}
                      >
                        <option value="BOTH">Обе</option>
                        <option value="UPPER">Верхняя</option>
                        <option value="LOWER">Нижняя</option>
                      </select>
                    ) : (
                      JAW_LABEL[m.jawScope] ?? m.jawScope
                    )}
                  </td>
                  <td className="align-top whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-primary !px-2 !py-1 text-xs"
                          disabled={busy || !draft.code.trim() || !draft.nameRu.trim()}
                          onClick={() => void saveEdit(m.id)}
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
                      <button
                        type="button"
                        className="btn-secondary !px-2 !py-1 text-xs"
                        disabled={busy || editingId !== null}
                        onClick={() => startEdit(m)}
                      >
                        Изменить
                      </button>
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
