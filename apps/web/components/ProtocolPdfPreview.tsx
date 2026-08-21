'use client';

import { useEffect } from 'react';

type ProtocolPdfPreviewProps = {
  blob: Blob;
  filename: string;
  url: string;
  onClose: () => void;
};

async function savePdf(blob: Blob, filename: string, fallbackUrl: string) {
  const picker = (
    window as Window & {
      showSaveFilePicker?: (options: {
        suggestedName?: string;
        types?: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<{
        createWritable: () => Promise<{
          write: (data: Blob) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    }
  ).showSaveFilePicker;

  if (typeof picker === 'function') {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }

  const a = document.createElement('a');
  a.href = fallbackUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ProtocolPdfPreview({ blob, filename, url, onClose }: ProtocolPdfPreviewProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="protocol-pdf-title"
    >
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded border border-border bg-white shadow-lg">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 id="protocol-pdf-title" className="truncate text-base font-semibold text-graphite">
            {filename}
          </h2>
          <div className="flex shrink-0 gap-2">
            <button type="button" className="btn-primary" onClick={() => void savePdf(blob, filename, url)}>
              Сохранить
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
        <iframe title={filename} src={url} className="min-h-0 w-full flex-1 bg-surface-muted" />
      </div>
    </div>
  );
}
