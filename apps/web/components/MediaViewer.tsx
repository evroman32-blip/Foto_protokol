'use client';

import { useEffect, useState } from 'react';

import { ObjViewer } from '@/components/ObjViewer';
import { StlViewer } from '@/components/StlViewer';
import { isTexturedScanAsset } from '@/lib/scan-bundle';
import { mediaApi, type MediaAssetDto, type MediaViewUrlDto } from '@/lib/api';

interface MediaViewerProps {
  assets: MediaAssetDto[];
  initialIndex: number;
  onClose: () => void;
}

function isImage(mime?: string, mediaType?: string) {
  return Boolean(mime?.startsWith('image/') || mediaType === 'PHOTO' || mediaType === 'RADIOLOGY_IMAGE');
}

function isVideo(mime?: string, mediaType?: string) {
  return Boolean(mime?.startsWith('video/') || mediaType === 'VIDEO');
}

function isPdf(mime?: string, mediaType?: string) {
  return Boolean(mime === 'application/pdf' || mediaType === 'DOCUMENT');
}

function isStl(mime?: string, mediaType?: string, fileName?: string) {
  const lower = (fileName ?? '').toLowerCase();
  if (isTexturedScanAsset(fileName, mime)) return false;
  return Boolean(
    mediaType === 'STL' ||
      mime === 'model/stl' ||
      mime === 'application/sla' ||
      mime?.includes('stl') ||
      lower.endsWith('.stl'),
  );
}

function isObjScan(mime?: string, _mediaType?: string, fileName?: string) {
  return isTexturedScanAsset(fileName, mime);
}

function assetBaseName(asset: MediaAssetDto) {
  const name = asset.displayName ?? asset.positionName ?? asset.originalFileName ?? 'Файл';
  return name.replace(/^\d+\.\s*/, '');
}

export function MediaViewer({ assets, initialIndex, onClose }: MediaViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [view, setView] = useState<MediaViewUrlDto | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, assets]);

  const asset = assets[index];
  const title = asset ? `${index + 1}. ${assetBaseName(asset)}` : 'Файл';

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setView(null);
    setDisplayUrl(null);

    void (async () => {
      try {
        const data = await mediaApi.viewUrl(asset.id);
        if (cancelled) return;
        setView(data);

        const fileName = data.originalFileName ?? asset.originalFileName;
        // Фото/видео/PDF: браузер грузит сам по same-origin URL (cookie + стрим API).
        // Это быстрее, чем скачивать весь файл в JS через fetch+blob.
        if (
          isImage(data.mimeType, data.mediaType) ||
          isVideo(data.mimeType, data.mediaType) ||
          isPdf(data.mimeType, data.mediaType)
        ) {
          const path =
            isImage(data.mimeType, data.mediaType)
              ? data.previewPath ?? `/api/v1/media/${asset.id}/content?variant=preview`
              : data.contentPath ?? `/api/v1/media/${asset.id}/content`;
          setDisplayUrl(path);
          return;
        }

        // 3D: по-прежнему через fetchContent внутри Stl/Obj viewer
        if (isStl(data.mimeType, data.mediaType, fileName) || isObjScan(data.mimeType, data.mediaType, fileName)) {
          setDisplayUrl(data.url);
          return;
        }

        // Прочий тип — blob через API
        const buffer = await mediaApi.fetchContent(asset.id);
        if (cancelled) return;
        const blob = new Blob([buffer], {
          type: data.mimeType || 'application/octet-stream',
        });
        objectUrl = URL.createObjectURL(blob);
        setDisplayUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось открыть файл');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset?.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(assets.length - 1, i + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [assets.length, onClose]);

  if (!asset) return null;

  const fileName = view?.originalFileName ?? asset.originalFileName;
  const mime = view?.mimeType;
  const mediaType = view?.mediaType ?? asset.mediaType;
  const src = displayUrl;
  const fullContentSrc = view?.contentPath ?? `/api/v1/media/${asset.id}/content`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded bg-white shadow-xl ${
          isStl(mime, mediaType, fileName) || isObjScan(mime, mediaType, fileName)
            ? 'max-w-6xl'
            : 'max-w-5xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-graphite">{title}</div>
            <div className="mt-0.5 truncate text-xs text-gray-500">
              {`${index + 1} / ${assets.length}`}
              {view?.hasPreview ? ' · превью' : ''}
            </div>
          </div>
          <button type="button" className="btn-secondary !px-3 !py-1 text-sm" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div className="flex min-h-[320px] flex-1 items-center justify-center bg-surface-muted/40 p-4">
          {loading ? <div className="text-sm text-gray-500">Загрузка…</div> : null}
          {error ? <div className="alert-error">{error}</div> : null}
          {!loading && !error && view && src ? (
            isObjScan(mime, mediaType, fileName) ? (
              <ObjViewer mediaId={asset.id} fallbackUrl={view.url} className="w-full" />
            ) : isStl(mime, mediaType, fileName) ? (
              <StlViewer mediaId={asset.id} fallbackUrl={view.url} className="w-full" />
            ) : isImage(mime, mediaType) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={title}
                className="max-h-[70vh] max-w-full object-contain"
                onError={(e) => {
                  // нет превью → оригинал
                  if (e.currentTarget.src.includes('variant=preview')) {
                    e.currentTarget.src = fullContentSrc;
                  }
                }}
              />
            ) : isVideo(mime, mediaType) ? (
              <video src={src} controls className="max-h-[70vh] max-w-full" />
            ) : isPdf(mime, mediaType) ? (
              <iframe title={title} src={src} className="h-[70vh] w-full rounded border border-border" />
            ) : (
              <div className="space-y-3 text-center text-sm">
                <p>Предпросмотр для этого типа файла недоступен.</p>
                <a href={fullContentSrc} target="_blank" rel="noreferrer" className="btn-primary inline-flex">
                  Скачать: {title}
                </a>
              </div>
            )
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <button
            type="button"
            className="btn-secondary"
            disabled={index <= 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            ← Предыдущий
          </button>
          {fullContentSrc ? (
            <a
              href={fullContentSrc}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-accent underline-offset-2 hover:underline"
            >
              Открыть оригинал
            </a>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="btn-secondary"
            disabled={index >= assets.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            Следующий →
          </button>
        </div>
      </div>
    </div>
  );
}
