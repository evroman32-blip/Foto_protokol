'use client';

import { MEDIA_BRANCH_ALL, MEDIA_BRANCH_LABELS } from '@mandarin/contracts';

interface MediaBranchModeToggleProps {
  types: string[];
  value: string | null | undefined;
  disabled?: boolean;
  busy?: boolean;
  onChange: (mode: string) => void;
}

export function MediaBranchModeToggle({
  types,
  value,
  disabled,
  busy,
  onChange,
}: MediaBranchModeToggleProps) {
  if (types.length < 2) return null;

  const options = [...types, MEDIA_BRANCH_ALL];

  return (
    <div className="mb-4 rounded border border-graphite/15 bg-white px-4 py-3">
      <div className="font-medium text-graphite">Вид информации для закрытия этапа</div>
      <p className="mt-1 text-sm text-graphite/70">
        В этапе есть разные типы материалов. Выберите, что обязательно для закрытия: один вид
        (или/или) либо все виды сразу.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((type) => {
          const selected = value === type;
          return (
            <button
              key={type}
              type="button"
              className={
                selected
                  ? 'btn-primary'
                  : 'rounded border border-graphite/20 bg-white px-4 py-2 text-sm text-graphite hover:bg-graphite/5'
              }
              disabled={disabled || busy}
              onClick={() => onChange(type)}
            >
              {MEDIA_BRANCH_LABELS[type] ?? type}
            </button>
          );
        })}
      </div>
      {!value ? (
        <p className="mt-2 text-sm text-amber-700">
          Выберите вид информации, иначе этап закрыть нельзя.
        </p>
      ) : null}
    </div>
  );
}
