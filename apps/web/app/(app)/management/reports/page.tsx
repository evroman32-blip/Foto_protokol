'use client';

import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { managementApi } from '@/lib/api';

export default function ManagementReportsPage() {
  const [reports, setReports] = useState<Array<{ id: string; reportType: string; generatedAt: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void managementApi
      .reports()
      .then(setReports)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Отчёты" description="PDF через pdfkit (API /reports)" />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Тип</th>
              <th>Сгенерирован</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{r.reportType}</td>
                <td>{new Date(r.generatedAt).toLocaleString('ru-RU')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
