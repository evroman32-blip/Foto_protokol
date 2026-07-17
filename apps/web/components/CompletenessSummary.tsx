'use client';

import type { CompletenessResult } from '@mandarin/contracts';

interface CompletenessSummaryProps {
  completeness?: CompletenessResult | null;
  data?: CompletenessResult | null;
}

export function CompletenessSummary({ completeness, data }: CompletenessSummaryProps) {
  const c = completeness ?? data;
  if (!c) return null;

  return (
    <div className="rounded border border-graphite/10 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-graphite">Комплектность этапа</h2>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            c.isComplete ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {c.isComplete ? 'Комплектен' : 'Неполный'}
        </span>
      </div>

      {c.blockingReasons.length > 0 ? (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <div className="mb-1 font-medium">Причины блокировки закрытия:</div>
          <ul className="list-inside list-disc space-y-1">
            {c.blockingReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {c.warnings.length > 0 ? (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="mb-1 font-medium">Предупреждения:</div>
          <ul className="list-inside list-disc space-y-1">
            {c.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {c.dependencyBlockers.length > 0 ? (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {c.dependencyBlockers.map((b) => (
            <div key={b}>{b}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
