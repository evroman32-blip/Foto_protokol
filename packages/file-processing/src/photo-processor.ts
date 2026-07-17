import sharp from 'sharp';
import type { PhotoProcessor, PhotoProcessingInput, PhotoProcessingResult } from './types';
import { validateFileSignature } from './file-signature';

function computeBlurScore(stats: sharp.Stats): number {
  const channel = stats.channels[0];
  if (!channel) return 1;
  const variance = channel.stdev ** 2;
  return Math.max(0, Math.min(1, 1 - variance / 5000));
}

function computeBrightness(stats: sharp.Stats): number {
  const channel = stats.channels[0];
  if (!channel) return 0.5;
  return Math.max(0, Math.min(1, channel.mean / 255));
}

async function computePerceptualHash(buffer: Buffer): Promise<string> {
  const { data, info } = await sharp(buffer)
    .resize(8, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Array.from(data);
  const avg = pixels.reduce((a, b) => a + b, 0) / pixels.length;
  return pixels.map((p) => (p >= avg ? '1' : '0')).join('');
}

export class SharpPhotoProcessor implements PhotoProcessor {
  validateSignature(buffer: Buffer, expectedMime: string): boolean {
    return validateFileSignature(buffer, expectedMime);
  }

  async process(input: PhotoProcessingInput): Promise<PhotoProcessingResult> {
    const image = sharp(input.buffer, { failOn: 'error' });
    const metadata = await image.metadata();
    const stats = await sharp(input.buffer).stats();

    const sanitized = sharp(input.buffer).rotate().withMetadata({ exif: undefined });

    const [thumbnail, preview] = await Promise.all([
      sanitized.clone().resize(256, 256, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer(),
      sanitized.clone().resize(1280, 1280, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer(),
    ]);

    const perceptualHash = await computePerceptualHash(input.buffer);

    return {
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      blurScore: computeBlurScore(stats),
      brightnessScore: computeBrightness(stats),
      perceptualHash,
      thumbnail,
      preview,
      exifRemoved: true,
    };
  }
}

export function createPhotoProcessor(): PhotoProcessor {
  return new SharpPhotoProcessor();
}
