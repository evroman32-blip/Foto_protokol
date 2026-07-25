import { zipStore } from '@/lib/zip-store';

const TEXTURE_EXT = /\.(jpe?g|png|bmp|webp)$/i;
const SCAN_MAX_BYTES = 100 * 1024 * 1024;

export { SCAN_MAX_BYTES };

function baseName(fileName: string): string {
  return fileName.replace(/^.*[\\/]/, '');
}

function stem(fileName: string): string {
  return baseName(fileName).replace(/\.[^.]+$/, '');
}

function isSitu(name: string): boolean {
  return name.toLowerCase().includes('situ');
}

/** Подсказка слота по имени файла экспорта exocad / сканера */
export function suggestScanSlotCode(fileName: string): string | null {
  const n = fileName.toLowerCase().replace(/\s+/g, '');
  if (n.includes('situ')) return null;
  if (n.includes('upperjaw') || /(^|[^a-z])upper([^a-z]|$)/.test(n)) return 'IMP_SCAN_UPPER';
  if (n.includes('lowerjaw') || /(^|[^a-z])lower([^a-z]|$)/.test(n)) return 'IMP_SCAN_LOWER';
  if (n.includes('totaljaw') || n.includes('bite') || n.includes('occlusion')) return 'IMP_SCAN_BITE';
  return null;
}

export function isScanBundleFileName(fileName?: string | null): boolean {
  const n = (fileName ?? '').toLowerCase();
  return n.endsWith('.obj.zip') || n.endsWith('.objbundle.zip') || (n.endsWith('.zip') && n.includes('.obj'));
}

export function isObjFileName(fileName?: string | null): boolean {
  return (fileName ?? '').toLowerCase().endsWith('.obj');
}

export function isTexturedScanAsset(fileName?: string | null, mimeType?: string | null): boolean {
  const n = (fileName ?? '').toLowerCase();
  const mime = (mimeType ?? '').toLowerCase();
  if (isScanBundleFileName(n) || isObjFileName(n)) return true;
  if (mime === 'model/obj' || mime === 'text/plain' && n.endsWith('.obj')) return true;
  if ((mime === 'application/zip' || mime === 'application/x-zip-compressed') && n.includes('obj')) {
    return true;
  }
  return false;
}

/**
 * Из выбранных файлов слота собирает один файл для загрузки:
 * приоритет — цветной набор OBJ+MTL+текстура (ZIP), иначе STL.
 */
export async function prepareScanUpload(files: File[]): Promise<{
  file: File;
  kind: 'obj-bundle' | 'stl';
  label: string;
}> {
  const list = files.filter((f) => f && f.size > 0 && !isSitu(f.name));
  if (!list.length) {
    throw new Error('Выберите файлы скана (.obj + .mtl + .jpg или .stl). Файлы Situ не используются.');
  }

  const obj = list.find((f) => /\.obj$/i.test(f.name));
  if (obj) {
    const objStem = stem(obj.name).toLowerCase();
    const companions = list.filter((f) => {
      if (f === obj) return false;
      const name = baseName(f.name);
      const lower = name.toLowerCase();
      if (!/\.mtl$/i.test(lower) && !TEXTURE_EXT.test(lower)) return false;
      const s = stem(name).toLowerCase();
      return s === objStem || lower.startsWith(objStem) || objStem.startsWith(s);
    });

    // Если пользователь выбрал MTL/JPG с тем же префиксом челюсти — берём их;
    // иначе кладём все MTL/текстуры из выбора (кроме Situ).
    const extras =
      companions.length > 0
        ? companions
        : list.filter(
            (f) => f !== obj && (/\.mtl$/i.test(f.name) || TEXTURE_EXT.test(f.name)),
          );

    const entries: { name: string; data: Uint8Array }[] = [];
    entries.push({ name: baseName(obj.name), data: new Uint8Array(await obj.arrayBuffer()) });
    for (const extra of extras) {
      entries.push({ name: baseName(extra.name), data: new Uint8Array(await extra.arrayBuffer()) });
    }

    const packed = zipStore(entries);
    if (packed.byteLength > SCAN_MAX_BYTES) {
      throw new Error(`Набор OBJ слишком большой (макс. ${SCAN_MAX_BYTES / (1024 * 1024)} МБ)`);
    }

    const zipName = `${stem(obj.name)}.obj.zip`;
    const file = new File([packed], zipName, { type: 'application/zip' });
    const hasTex = extras.some((f) => TEXTURE_EXT.test(f.name));
    return {
      file,
      kind: 'obj-bundle',
      label: hasTex
        ? `${baseName(obj.name)} + текстура (${extras.length + 1} файлов)`
        : `${baseName(obj.name)} (без текстуры, ${extras.length + 1} файлов)`,
    };
  }

  const stl = list.find((f) => /\.stl$/i.test(f.name));
  if (!stl) {
    throw new Error('Нужен файл .obj (с .mtl/.jpg) или .stl');
  }
  if (stl.size > SCAN_MAX_BYTES) {
    throw new Error(`STL «${stl.name}» слишком большой (макс. ${SCAN_MAX_BYTES / (1024 * 1024)} МБ)`);
  }
  return { file: stl, kind: 'stl', label: baseName(stl.name) };
}
