'use client';

interface StageTabsProps {
  active?: string;
  onChange?: (tab: string) => void;
}

const TABS = [
  { key: 'photo', label: 'Фото' },
  { key: 'video', label: 'Видео' },
  { key: 'docs', label: 'Документы' },
  { key: 'stl', label: 'STL' },
  { key: 'radiology', label: 'Рентгенология' },
  { key: 'checklist', label: 'Чек-лист' },
  { key: 'history', label: 'История' },
];

export function StageTabs({ active = 'checklist', onChange }: StageTabsProps) {
  return (
    <nav className="-mb-px flex flex-wrap gap-1 border-b border-graphite/15">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange?.(tab.key)}
          className={`border-b-2 px-3 py-2 text-sm transition ${
            active === tab.key
              ? 'border-accent font-medium text-accent'
              : 'border-transparent text-graphite/60 hover:text-graphite'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
