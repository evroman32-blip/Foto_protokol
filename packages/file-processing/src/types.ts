export interface PhotoProcessingInput {
  buffer: Buffer;
  mimeType: string;
}

export interface PhotoProcessingResult {
  width: number;
  height: number;
  blurScore: number;
  brightnessScore: number;
  perceptualHash: string;
  thumbnail: Buffer;
  preview: Buffer;
  exifRemoved: boolean;
}

export interface PhotoProcessor {
  process(input: PhotoProcessingInput): Promise<PhotoProcessingResult>;
  validateSignature(buffer: Buffer, expectedMime: string): boolean;
}

export interface VideoMetadata {
  width: number;
  height: number;
  durationSec: number;
  fps: number;
  hasAudio: boolean;
  codec: string;
}

export interface VideoProcessingInput {
  filePath: string;
  mimeType: string;
}

export interface VideoProcessingResult {
  metadata: VideoMetadata;
  posterFrame: Buffer;
  webCompatiblePath?: string;
}

export interface VideoProcessor {
  process(input: VideoProcessingInput): Promise<VideoProcessingResult>;
  probe(filePath: string): Promise<VideoMetadata>;
}

export interface FileSignatureRule {
  mimeType: string;
  extensions: string[];
  signatures: number[][];
}
