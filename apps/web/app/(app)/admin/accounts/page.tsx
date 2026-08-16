'use client';

import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { adminApi, type AccountRequestDto } from '@/lib/api';
import { notifyAccountRequestsChanged } from '@/lib/pending-account-requests';
import { useCurrentUser } from '@/lib/use-current-user';

export default function AccountRequestsPage() {
  const { canApproveAccounts, loading: userLoading } = useCurrentUser();
  const [rows, setRows] = useState<AccountRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const next = await adminApi.accountRequests('PENDING');
      setRows(next);
      notifyAccountRequestsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить заявки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!userLoading && canApproveAccounts) void load();
    if (!userLoading && !canApproveAccounts) setLoading(false);
  }, [userLoading, canApproveAccounts]);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await adminApi.approveAccount(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подтвердить');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await adminApi.rejectAccount(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отклонить');
    } finally {
      setBusyId(null);
    }
  }

  if (userLoading || loading) return <LoadingState />;
  if (!canApproveAccounts) {
    return <ErrorState message="Подтверждать права могут только администратор и главный врач." />;
  }

  return (
    <div>
      <PageHeader
        title="Заявки на доступ"
        count={rows.length}
        description="Пока заявка не подтверждена, пользователь видит сервис только в режиме просмотра."
      />
      {error ? <div className="alert-error mb-4">{error}</div> : null}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Почта / телефон</th>
              <th>Должность / права</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-sm text-gray-500">
                  Нет заявок, ожидающих подтверждения.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {[row.lastName, row.firstName, row.middleName].filter(Boolean).join(' ')}
                  </td>
                  <td>
                    <div>{row.email}</div>
                    <div className="text-xs text-gray-500">{row.phone ?? '—'}</div>
                  </td>
                  <td>
                    <div>{[row.position, row.specialization].filter(Boolean).join(' · ') || '—'}</div>
                    <div className="text-xs text-gray-500">
                      {row.requestedRoleLabel ?? row.requestedRole ?? '—'}
                    </div>
                  </td>
                  <td className="space-x-2">
                    <button
                      type="button"
                      className="btn-primary !px-3 !py-1 text-xs"
                      disabled={busyId === row.id}
                      onClick={() => void approve(row.id)}
                    >
                      Подтвердить
                    </button>
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1 text-xs"
                      disabled={busyId === row.id}
                      onClick={() => void reject(row.id)}
                    >
                      Отклонить
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
