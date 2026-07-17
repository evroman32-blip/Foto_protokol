'use client';

interface JawRelationBannerProps {
  stageCode?: string;
  completeness?: { dependencyBlockers?: string[]; isComplete?: boolean } | null;
}

export function JawRelationBanner({ stageCode, completeness }: JawRelationBannerProps) {
  if (stageCode && stageCode !== 'JAW_RELATION' && completeness === undefined) {
    // bare usage without props — always show clinical message
  }

  const blockers = completeness?.dependencyBlockers ?? [];
  const message =
    blockers[0] ??
    'Этап заблокирован до завершения послеоперационного хирургического и рентгенологического контроля.';

  return (
    <div className="mb-4 rounded border border-amber-200 border-l-4 border-l-accent bg-amber-50 px-4 py-3">
      <div className="font-medium text-graphite">Зависимость JAW_RELATION</div>
      <p className="mt-1 text-sm text-graphite/80">{message}</p>
    </div>
  );
}
