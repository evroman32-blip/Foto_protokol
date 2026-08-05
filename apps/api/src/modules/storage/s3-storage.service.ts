import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

@Injectable()
export class S3StorageService {
  private readonly client: S3Client;
  /** Client with public endpoint for browser-facing signed URLs */
  private readonly publicClient: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET ?? 'photoprotocol';
    const region = process.env.S3_REGION ?? 'us-east-1';
    const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true';
    const credentials = {
      accessKeyId:
        process.env.S3_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey:
        process.env.S3_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_KEY ?? 'minioadmin',
    };
    const internalEndpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
    const publicEndpoint =
      process.env.S3_PUBLIC_ENDPOINT ||
      process.env.S3_PUBLIC_BASE_URL ||
      internalEndpoint;

    this.client = new S3Client({
      region,
      endpoint: internalEndpoint,
      forcePathStyle,
      credentials,
    });
    this.publicClient = new S3Client({
      region,
      endpoint: publicEndpoint,
      forcePathStyle,
      credentials,
    });
  }

  buildObjectKey(prefix: string, fileName: string): string {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${prefix}/${randomUUID()}/${safeName}`;
  }

  async getPresignedUploadUrl(objectKey: string, mimeType: string, expiresIn = 3600) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: mimeType,
    });
    // Uploads go through API in most flows; public host keeps browser CORS/simple PUTs working in demo.
    const url = await getSignedUrl(this.publicClient, command, { expiresIn });
    return { url, objectKey, bucket: this.bucket };
  }

  async getPresignedDownloadUrl(objectKey: string, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });
    return getSignedUrl(this.publicClient, command, { expiresIn });
  }

  async getObjectBuffer(objectKey: string): Promise<{ body: Buffer; contentType?: string }> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) throw new Error('Пустой объект в хранилище');
    return {
      body: Buffer.from(bytes),
      contentType: result.ContentType,
    };
  }

  /** Стрим из MinIO как Node.js Readable (для Nest StreamableFile) */
  async getObjectStream(objectKey: string): Promise<{
    body: Readable;
    contentType?: string;
    contentLength?: number;
  }> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );
    if (!result.Body) throw new Error('Пустой объект в хранилище');

    const raw = result.Body as {
      pipe?: unknown;
      transformToWebStream?: () => ReadableStream;
      transformToByteArray?: () => Promise<Uint8Array>;
    };

    let body: Readable;
    if (typeof raw.pipe === 'function') {
      body = raw as unknown as Readable;
    } else if (typeof raw.transformToWebStream === 'function') {
      body = Readable.fromWeb(raw.transformToWebStream() as import('stream/web').ReadableStream);
    } else if (typeof raw.transformToByteArray === 'function') {
      body = Readable.from(Buffer.from(await raw.transformToByteArray()));
    } else {
      throw new Error('Неподдерживаемый тип потока S3');
    }

    return {
      body,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
    };
  }

  async putObject(objectKey: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async objectExists(objectKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      return true;
    } catch {
      return false;
    }
  }

  getBucket(): string {
    return this.bucket;
  }

  getClient(): S3Client {
    return this.client;
  }
}
