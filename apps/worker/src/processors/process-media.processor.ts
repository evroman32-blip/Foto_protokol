import { Job } from 'bullmq';
import { prisma } from '@mandarin/database';
import { downloadObject, processPhotoBuffer, probeVideo, updateMediaProcessing } from '../services/media-utils';
import { QUEUE_NAMES } from '../queue-names';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { getEnv } from '@mandarin/config';

export function createProcessMediaProcessor() {
  const env = getEnv();
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const derivativesQueue = new Queue(QUEUE_NAMES.GENERATE_DERIVATIVES, { connection });

  return async (job: Job<{ mediaAssetId: string }>) => {
    const asset = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: job.data.mediaAssetId },
    });

    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { status: 'PROCESSING' },
    });

    const buffer = await downloadObject(asset.storedObjectKey);

    if (asset.mediaType === 'PHOTO') {
      const { buffer: processed, width, height } = await processPhotoBuffer(buffer);
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
  };
}
