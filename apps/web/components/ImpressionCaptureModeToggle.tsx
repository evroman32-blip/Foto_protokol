'use client';

export type ImpressionCaptureModeValue = 'SCAN' | 'IMPRESSION';

interface ImpressionCaptureModeToggleProps {
  value: ImpressionCaptureModeValue | null | undefined;
  disabled?: boolean;
  busy?: boolean;
  onChange: (mode: ImpressionCaptureModeValue) => void;
}

export function ImpressionCaptureModeToggle({
  value,
  disabled,
  busy,
  onChange,
}: ImpressionCaptureModeToggleProps) {
  return (
    <div className="mb-4 rounded border border-graphite/15 bg-white px-4 py-3">
      <div className="font-medium text-graphite">Способ получения</div>
      <p className="mt-1 text-sm text-graphite/70">
        На этом этапе доктор делает либо цифровые сканы, либо фото оттисков — не оба сразу.
        Обязательны только материалы выбранного способа.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={
            value === 'SCAN'
              ? 'btn-primary'
              : 'rounded border border-graphite/20 bg-white px-4 py-2 text-sm text-graphite hover:bg-graphite/5'
          }
          disabled={disabled || busy}
          onClick={() => onChange('SCAN')}
        >
          Скан (STL / OBJ)
        </button>
        <button
          type="button"
          className={
            value === 'IMPRESSION'
              ? 'btn-primary'
              : 'rounded border border-graphite/20 bg-white px-4 py-2 text-sm text-graphite hover:bg-graphite/5'
          }
          disabled={disabled || busy}
          onClick={() => onChange('IMPRESSION')}
        >
          Оттиск (фото)
        </button>
      </div>
      {!value ? (
        <p className="mt-2 text-sm text-amber-700">Выберите способ получения, чтобы продолжить.</p>
      ) : null}
    </div>
  );
}
