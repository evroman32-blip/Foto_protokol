import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getEnv } from '@mandarin/config';
import { prisma } from '@mandarin/database';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

export function createS3Client() {
  const env = getEnv();
  return new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE ?? true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
}

export async function downloadObject(key: string): Promise<Buffer> {
  const env = getEnv();
  const client = createS3Client();
  const res = await client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  const stream = res.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function uploadObject(key: string, body: Buffer, mimeType: string) {
  const env = getEnv();
  const client = createS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: mimeType,
    }),
  );
}

export async function isFfmpegAvailable(): Promise<boolean> {
  const env = getEnv();
  try {
    await execFileAsync(env.FFMPEG_PATH, ['-version']);
    return true;
  } catch {
    return false;
  }
}

export async function probeVideo(buffer: Buffer): Promise<{ durationSec: number; hasAudio: boolean }> {
  const env = getEnv();
  const available = await isFfmpegAvailable();
  if (!available) {
    return { durationSec: 0, hasAudio: false };
  }
  try {
    const { stdout } = await execFileAsync(env.FFPROBE_PATH, [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=codec_type',
      '-of',
      'json',
      '-',
    ], { input: buffer });
    const parsed = JSON.parse(stdout) as { format?: { duration?: string }; streams?: Array<{ codec_type?: string }> };
    return {
      durationSec: parseFloat(parsed.format?.duration ?? '0'),
      hasAudio: (parsed.streams ?? []).some((s) => s.codec_type === 'audio'),
    };
  } catch {
    return { durationSec: 0, hasAudio: false };
  }
}

export async function processPhotoBuffer(buffer: Buffer) {
  const image = sharp(buffer);
  const meta = await image.metadata();
  const sanitized = await image.rotate().toBuffer();
  return { buffer: sanitized, width: meta.width ?? null, height: meta.height ?? null };
}

export async function updateMediaProcessing(mediaAssetId: string, data: {
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  hasAudio?: boolean | null;
}) {
  await prisma.mediaAsset.update({
    where: { id: mediaAssetId },
    data: { status: 'UNASSIGNED' },
  });
  await prisma.mediaMetadata.upsert({
    where: { mediaAssetId },
    create: { mediaAssetId, ...data },
    update: data,
  });
}
