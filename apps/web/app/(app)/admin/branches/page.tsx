'use client';

import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { adminApi, type BranchDto } from '@/lib/api';

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void adminApi.branches().then(setBranches).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Филиалы" description="GET/POST/PATCH /api/v1/branches" />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Адрес</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.address ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
