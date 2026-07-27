const IMP_SCAN_CODES = new Set(['IMP_SCAN_UPPER', 'IMP_SCAN_LOWER']);
const IMP_PHOTO_CODES = new Set([
  'IMP_PHOTO_IMPRESSIONS_UPPER',
  'IMP_PHOTO_IMPRESSIONS_LOWER',
  'IMP_PHOTO_IMPRESSIONS',
]);

/** Зеркало доменной логики для бейджей на UI. */
export function isRequirementEffectivelyRequired(opts: {
  stageCode?: string | null;
  impressionCaptureMode?: 'SCAN' | 'IMPRESSION' | null;
  code: string;
  templateRequired: boolean;
}): boolean {
  if (!opts.templateRequired) return false;
  if (opts.code === 'ADDITIONAL_MEDIA' || opts.code.endsWith('_ADDITIONAL_MEDIA')) {
    return false;
  }
  if (opts.stageCode !== 'IMPRESSIONS_OR_SCANS') return true;

  const isScan = IMP_SCAN_CODES.has(opts.code);
  const isPhoto = IMP_PHOTO_CODES.has(opts.code);
  if (!isScan && !isPhoto) return true;

  const mode = opts.impressionCaptureMode;
  if (!mode) return false;
  if (mode === 'SCAN') return isScan;
  if (mode === 'IMPRESSION') return isPhoto;
  return true;
}

export function requirementInactiveHint(opts: {
  stageCode?: string | null;
  impressionCaptureMode?: 'SCAN' | 'IMPRESSION' | null;
  code: string;
  templateRequired: boolean;
}): string | null {
  if (opts.stageCode !== 'IMPRESSIONS_OR_SCANS' || !opts.templateRequired) return null;
  const isScan = IMP_SCAN_CODES.has(opts.code);
  const isPhoto = IMP_PHOTO_CODES.has(opts.code);
  if (!isScan && !isPhoto) return null;
  if (!opts.impressionCaptureMode) return 'Сначала выберите способ получения';
  if (opts.impressionCaptureMode === 'SCAN' && isPhoto) {
    return 'Не требуется (выбран скан)';
  }
  if (opts.impressionCaptureMode === 'IMPRESSION' && isScan) {
    return 'Не требуется (выбран оттиск)';
  }
  return null;
}
