import { Job } from 'bullmq';
import { prisma } from '@mandarin/database';
import { downloadObject, processPhotoBuffer, probeVideo, updateMediaProcessing } from '../services/media-utils';
import { QUEUE_NAMES } from '../queue-names';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { getEnv } from '@mandarin/config';

type ProcessMediaJob = {
  mediaAssetId?: string;
  uploadBatchId?: string;
};

export function createProcessMediaProcessor() {
  const env = getEnv();
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const derivativesQueue = new Queue(QUEUE_NAMES.GENERATE_DERIVATIVES, { connection });

  async function processAsset(mediaAssetId: string) {
    const asset = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: mediaAssetId },
    });

    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { status: 'PROCESSING' },
    });

    const buffer = await downloadObject(asset.storedObjectKey);

    if (asset.mediaType === 'PHOTO') {
      const { width, height } = await processPhotoBuffer(buffer);
      await updateMediaProcessing(asset.id, { width, height });
    } else if (asset.mediaType === 'VIDEO') {
      const { durationSec, hasAudio } = await probeVideo(buffer);
      await updateMediaProcessing(asset.id, { durationSec, hasAudio });
    } else {
      await updateMediaProcessing(asset.id, {});
    }

    await derivativesQueue.add('generate', { mediaAssetId: asset.id });
    await derivativesQueue.add('ai-classify', { mediaAssetId: asset.id }, { delay: 1000 });

    return { mediaAssetId: asset.id, status: 'processed' };
  }

  return async (job: Job<ProcessMediaJob>) => {
    if (job.data.mediaAssetId) {
      return processAsset(job.data.mediaAssetId);
    }

    // Закрытие пакета: отдельного файла нет, дообрабатываем то, что осталось.
    const uploadBatchId = job.data.uploadBatchId;
    if (!uploadBatchId) return { skipped: true };

    const pending = await prisma.mediaAsset.findMany({
      where: { uploadBatchId, status: 'UPLOADED', archivedAt: null },
      select: { id: true },
    });

    for (const asset of pending) {
      await processAsset(asset.id);
    }

    await prisma.uploadBatch.update({
      where: { id: uploadBatchId },
      data: { status: 'COMPLETED' },
    });

    return { uploadBatchId, processed: pending.length };
  };
}
