'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

interface StageTabsProps {
  active?: string;
  stageCode?: string;
}

const BASE_TABS = [
  { key: 'photo', label: 'Фото', mode: 'upload' as const },
  { key: 'video', label: 'Видео', mode: 'upload' as const },
  { key: 'docs', label: 'Документы', mode: 'upload' as const },
  { key: 'stl', label: 'STL', mode: 'upload' as const },
  { key: 'radiology', label: 'Рентгенология', mode: 'upload' as const },
  { key: 'report', label: 'Отчёт', mode: 'report' as const },
  { key: 'checklist', label: 'Чек-лист', mode: 'main' as const },
  { key: 'history', label: 'История', mode: 'main' as const },
];

export function StageTabs({ active = 'checklist', stageCode }: StageTabsProps) {
  const params = useParams<{ id: string; stageId: string }>();
  const caseId = params?.id;
  const stageId = params?.stageId;
  const isSurgical = stageCode === 'POSTOP_SURGICAL_RADIOLOGY_CONTROL';

  const tabs = BASE_TABS.filter((tab) => (tab.key === 'report' ? isSurgical : true));

  function hrefFor(tab: (typeof BASE_TABS)[number]): string | null {
    if (!caseId || !stageId) return null;
    const base = `/cases/${caseId}/stages/${stageId}`;
    if (tab.mode === 'upload') return `${base}/upload?tab=${tab.key}`;
    if (tab.mode === 'report') return `${base}/surgical-radiology`;
    return base;
  }

  return (
    <nav className="-mb-px flex flex-wrap gap-1 border-b border-graphite/15">
      {tabs.map((tab) => {
        const href = hrefFor(tab);
        const isActive = active === tab.key;
        const className = `border-b-2 px-3 py-2 text-sm transition ${
          isActive
            ? 'border-accent font-medium text-accent'
            : 'border-transparent text-graphite/60 hover:text-graphite'
        }`;
        if (!href) {
          return (
            <span key={tab.key} className={className}>
              {tab.label}
            </span>
          );
        }
        return (
          <Link key={tab.key} href={href} className={className}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
