import { Job } from 'bullmq';
import { prisma } from '@mandarin/database';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { downloadObject, uploadObject } from '../services/media-utils';

export function createGenerateDerivativesProcessor() {
  return async (job: Job<{ mediaAssetId: string }>) => {
    const asset = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: job.data.mediaAssetId },
    });

    if (asset.mediaType !== 'PHOTO' && asset.mediaType !== 'VIDEO') {
      return { skipped: true };
    }

    if (asset.mediaType === 'PHOTO') {
      const original = await downloadObject(asset.storedObjectKey);
      const derivatives = [
        { type: 'THUMBNAIL' as const, width: 200 },
        { type: 'PREVIEW' as const, width: 800 },
      ];

      for (const spec of derivatives) {
        const resized = await sharp(original).resize(spec.width).jpeg({ quality: 85 }).toBuffer();
        const meta = await sharp(resized).metadata();
        const objectKey = `derivatives/${asset.id}/${spec.type.toLowerCase()}-${uuidv4()}.jpg`;
        await uploadObject(objectKey, resized, 'image/jpeg');
        await prisma.mediaDerivative.create({
          data: {
            mediaAssetId: asset.id,
            type: spec.type,
            objectKey,
            mimeType: 'image/jpeg',
            width: meta.width,
            height: meta.height,
          },
        });
      }
    }

    if (asset.mediaType === 'VIDEO') {
      const objectKey = `derivatives/${asset.id}/poster-${uuidv4()}.jpg`;
      const placeholder = await sharp({
        create: { width: 640, height: 360, channels: 3, background: { r: 30, g: 30, b: 30 } },
      })
        .jpeg()
        .toBuffer();
      await uploadObject(objectKey, placeholder, 'image/jpeg');
      await prisma.mediaDerivative.create({
        data: {
          mediaAssetId: asset.id,
          type: 'POSTER',
          objectKey,
          mimeType: 'image/jpeg',
          width: 640,
          height: 360,
        },
      });
    }

    return { mediaAssetId: asset.id, derivativesCreated: true };
  };
}
