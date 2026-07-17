'use client';

import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { adminApi, type ImplantMethodDto } from '@/lib/api';

export default function ImplantMethodsPage() {
  const [methods, setMethods] = useState<ImplantMethodDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void adminApi.implantMethods({ active: true }).then(setMethods).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Методы имплантации" description="Справочник M1A–M16B (25 методов)" />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Код</th>
              <th>№</th>
              <th>Название</th>
              <th>Челюсть</th>
            </tr>
          </thead>
          <tbody>
            {methods.map((m) => (
              <tr key={m.id}>
                <td className="font-mono">{m.code}</td>
                <td>{m.methodNumber}{m.submethodCode ?? ''}</td>
                <td>{m.nameRu}</td>
                <td>{m.jawScope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
