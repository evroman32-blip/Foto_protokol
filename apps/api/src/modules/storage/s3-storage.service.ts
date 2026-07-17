import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET ?? 'photoprotocol';
    this.client = new S3Client({
      region: process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
      credentials: {
        accessKeyId:
          process.env.S3_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY ?? 'minioadmin',
        secretAccessKey:
          process.env.S3_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_KEY ?? 'minioadmin',
      },
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
    const url = await getSignedUrl(this.client, command, { expiresIn });
    return { url, objectKey, bucket: this.bucket };
  }

  async getPresignedDownloadUrl(objectKey: string, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });
    return getSignedUrl(this.client, command, { expiresIn });
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
