'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { StageTabs } from '@/components/StageTabs';
import { uploadApi } from '@/lib/api';

export default function StageUploadPage() {
  const { id: caseId, stageId } = useParams<{ id: string; stageId: string }>();
  const [files, setFiles] = useState<FileList | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleUpload() {
    if (!files?.length) {
      setError('Выберите файлы для загрузки');
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    setProgress(0);

    try {
      const { batchId } = await uploadApi.createBatch(stageId);
      const fileArray = Array.from(files);

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const presign = await uploadApi.presign(batchId, {
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        });
        await uploadApi.uploadFile(presign, file, (pct) => {
          const overall = Math.round(((i + pct / 100) / fileArray.length) * 100);
          setProgress(overall);
        });
      }

      await uploadApi.completeBatch(batchId);
      setMessage(`Загружено файлов: ${fileArray.length}`);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Загрузка материалов"
        description="Пакетная загрузка с presigned URL в объектное хранилище"
        actions={
          <Link href={`/cases/${caseId}/stages/${stageId}`} className="btn-secondary">
            Назад к этапу
          </Link>
        }
      />

      <StageTabs active="main" />

      <div className="card max-w-xl">
        <label className="label-field" htmlFor="files">
          Файлы (фото, видео, документы)
        </label>
        <input
          id="files"
          type="file"
          multiple
          className="input-field mb-4"
          onChange={(e) => setFiles(e.target.files)}
        />

        {progress !== null ? (
          <div className="mb-4">
            <div className="mb-1 text-sm text-gray-600">Прогресс: {progress}%</div>
            <div className="h-2 overflow-hidden rounded bg-surface-muted">
              <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        {error ? <div className="mb-3 text-sm text-status-error">{error}</div> : null}
        {message ? <div className="mb-3 text-sm text-status-success">{message}</div> : null}

        <button type="button" className="btn-primary" disabled={busy} onClick={() => void handleUpload()}>
          {busy ? 'Загрузка…' : 'Начать загрузку'}
        </button>
      </div>
    </div>
  );
}
