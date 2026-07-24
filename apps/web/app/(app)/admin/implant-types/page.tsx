'use client';

import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { adminApi, type ImplantTypeDto } from '@/lib/api';

type EditDraft = {
  nameRu: string;
  brand: string;
};

export default function ImplantTypesPage() {
  const [items, setItems] = useState<ImplantTypeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [nameRu, setNameRu] = useState('');
  const [brand, setBrand] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await adminApi.implantTypes({ active: true }));
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
      await adminApi.createImplantType({
        code,
        nameRu,
        brand: brand || undefined,
        sortOrder: items.length + 1,
      });
      setCode('');
      setNameRu('');
      setBrand('');
      setMessage('Вид имплантата добавлен');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(item: ImplantTypeDto) {
    setEditingId(item.id);
    setDraft({
      nameRu: item.nameRu,
      brand: item.brand ?? '',
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
      await adminApi.updateImplantType(id, {
        nameRu: draft.nameRu.trim(),
        brand: draft.brand.trim() || null,
      });
      setMessage('Вид имплантата сохранён');
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
        title="Виды имплантатов"
        description="Справочник для карточек срезов. Добавление и редактирование записей."
      />
      {error ? <div className="alert-error mb-4">{error}</div> : null}
      {message ? <div className="mb-4 text-sm text-status-success">{message}</div> : null}

      <div className="card mb-4 grid gap-3 sm:grid-cols-4">
        <div>
          <label className="label-field">Код</label>
          <input
            className="input-field"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="BCS"
          />
        </div>
        <div>
          <label className="label-field">Название</label>
          <input className="input-field" value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
        </div>
        <div>
          <label className="label-field">Бренд</label>
          <input className="input-field" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy || !code || !nameRu}
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
              <th>Код</th>
              <th>Название</th>
              <th>Бренд</th>
              <th className="w-40">Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isEditing = editingId === item.id && draft;
              return (
                <tr key={item.id}>
                  <td className="font-mono align-top">{item.code}</td>
                  <td className="align-top">
                    {isEditing ? (
                      <input
                        className="input-field min-w-[12rem]"
                        value={draft.nameRu}
                        onChange={(e) => setDraft({ ...draft, nameRu: e.target.value })}
                      />
                    ) : (
                      item.nameRu
                    )}
                  </td>
                  <td className="align-top">
                    {isEditing ? (
                      <input
                        className="input-field"
                        value={draft.brand}
                        onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                      />
                    ) : (
                      item.brand ?? '—'
                    )}
                  </td>
                  <td className="align-top whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-primary !px-2 !py-1 text-xs"
                          disabled={busy || !draft.nameRu.trim()}
                          onClick={() => void saveEdit(item.id)}
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
                        disabled={busy}
                        onClick={() => startEdit(item)}
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
