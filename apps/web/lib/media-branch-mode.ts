import {
  MEDIA_BRANCH_ALL,
  MEDIA_BRANCH_LABELS,
  hasMixedMediaBranches,
  isImplantSliceCardsRequirement,
  listMediaBranchTypes,
} from '@mandarin/contracts';

export {
  MEDIA_BRANCH_ALL,
  MEDIA_BRANCH_LABELS,
  hasMixedMediaBranches,
  isImplantSliceCardsRequirement,
  listMediaBranchTypes,
};

export function isMediaBranchRequirementActive(opts: {
  stageCode?: string | null;
  mediaBranchMode?: string | null;
  mixedMediaBranches?: boolean;
  mediaType: string;
  templateRequired: boolean;
}): boolean {
  if (!opts.templateRequired) return false;
  if (opts.stageCode === 'IMPRESSIONS_OR_SCANS') return true;
  if (!opts.mixedMediaBranches) return true;
  if (!opts.mediaBranchMode) return false;
  if (opts.mediaBranchMode === MEDIA_BRANCH_ALL) return true;
  return opts.mediaType === opts.mediaBranchMode;
}

export function mediaBranchInactiveHint(opts: {
  stageCode?: string | null;
  mediaBranchMode?: string | null;
  mixedMediaBranches?: boolean;
  mediaType: string;
  templateRequired: boolean;
}): string | null {
  if (opts.stageCode === 'IMPRESSIONS_OR_SCANS' || !opts.templateRequired || !opts.mixedMediaBranches) {
    return null;
  }
  if (!opts.mediaBranchMode) return 'Сначала выберите вид информации для закрытия этапа';
  if (opts.mediaBranchMode === MEDIA_BRANCH_ALL) return null;
  if (opts.mediaType === opts.mediaBranchMode) return null;
  const chosen = MEDIA_BRANCH_LABELS[opts.mediaBranchMode] ?? opts.mediaBranchMode;
  return `Не требуется (выбрано: ${chosen})`;
}
