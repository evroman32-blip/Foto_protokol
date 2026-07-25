'use client';

import { useEffect, useState } from 'react';

import { mediaApi, type MediaAssetDto, type MediaViewUrlDto } from '@/lib/api';

interface MediaViewerProps {
  assets: MediaAssetDto[];
  initialIndex: number;
  onClose: () => void;
  /** Подпись набора, напр. «Фото этапа» */
  setLabel?: string;
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

function mediaTypeLabel(mediaType?: string) {
  switch (mediaType) {
    case 'PHOTO':
      return 'Фото';
    case 'VIDEO':
      return 'Видео';
    case 'DOCUMENT':
      return 'Документ';
    case 'STL':
      return 'STL';
    case 'RADIOLOGY_IMAGE':
      return 'Рентген';
    default:
      return mediaType ?? 'Файлы';
  }
}

function assetBaseName(asset: MediaAssetDto) {
  const name = asset.displayName ?? asset.positionName ?? asset.originalFileName ?? 'Файл';
  return name.replace(/^\d+\.\s*/, '');
}

export function MediaViewer({ assets, initialIndex, onClose, setLabel }: MediaViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [view, setView] = useState<MediaViewUrlDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, assets]);

  const asset = assets[index];
  const title = asset ? `${index + 1}. ${assetBaseName(asset)}` : 'Файл';
  const typeLabel = setLabel ?? mediaTypeLabel(asset?.mediaType);

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setView(null);
    void mediaApi
      .viewUrl(asset.id)
      .then((data) => {
        if (!cancelled) setView(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось открыть файл');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-graphite">{title}</div>
            <div className="mt-0.5 truncate text-xs text-gray-500">
              {typeLabel}
              {asset.requirementCode ? ` · ${asset.requirementCode}` : ''}
              {` · ${index + 1} / ${assets.length} (порядок протокола)`}
            </div>
          </div>
          <button type="button" className="btn-secondary !px-3 !py-1 text-sm" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <div className="flex min-h-[320px] flex-1 items-center justify-center bg-surface-muted/40 p-4">
          {loading ? <div className="text-sm text-gray-500">Загрузка…</div> : null}
          {error ? <div className="alert-error">{error}</div> : null}
          {!loading && !error && view ? (
            isImage(view.mimeType, view.mediaType) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={view.url} alt={title} className="max-h-[70vh] max-w-full object-contain" />
            ) : isVideo(view.mimeType, view.mediaType) ? (
              <video src={view.url} controls className="max-h-[70vh] max-w-full" />
            ) : isPdf(view.mimeType, view.mediaType) ? (
              <iframe title={title} src={view.url} className="h-[70vh] w-full rounded border border-border" />
            ) : (
              <div className="space-y-3 text-center text-sm">
                <p>Предпросмотр для этого типа файла недоступен.</p>
                <a href={view.url} target="_blank" rel="noreferrer" className="btn-primary inline-flex">
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
          {view?.url ? (
            <a
              href={view.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-accent underline-offset-2 hover:underline"
            >
              Открыть в новой вкладке
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
