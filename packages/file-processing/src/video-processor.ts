import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import type { VideoProcessor, VideoProcessingInput, VideoProcessingResult, VideoMetadata } from './types';

const execFileAsync = promisify(execFile);

export class MockVideoProcessor implements VideoProcessor {
  constructor(
    private readonly ffprobePath = 'ffprobe',
    private readonly ffmpegPath = 'ffmpeg',
  ) {}

  async probe(filePath: string): Promise<VideoMetadata> {
    try {
      const { stdout } = await execFileAsync(this.ffprobePath, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath,
      ]);
      const data = JSON.parse(stdout) as {
        format?: { duration?: string };
        streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; r_frame_rate?: string }>;
      };
      const videoStream = data.streams?.find((s) => s.codec_type === 'video');
      const audioStream = data.streams?.find((s) => s.codec_type === 'audio');
      const fpsParts = videoStream?.r_frame_rate?.split('/') ?? ['0', '1'];
      const fps = Number(fpsParts[0]) / (Number(fpsParts[1]) || 1);

      return {
        width: videoStream?.width ?? 0,
        height: videoStream?.height ?? 0,
        durationSec: parseFloat(data.format?.duration ?? '0'),
        fps,
        hasAudio: !!audioStream,
        codec: videoStream?.codec_name ?? 'unknown',
      };
    } catch {
      return {
        width: 1280,
        height: 720,
        durationSec: 10,
        fps: 30,
        hasAudio: true,
        codec: 'h264',
      };
    }
  }

  async process(input: VideoProcessingInput): Promise<VideoProcessingResult> {
    const metadata = await this.probe(input.filePath);
    let posterFrame: Buffer;

    try {
      const posterPath = `${input.filePath}.poster.jpg`;
      await execFileAsync(this.ffmpegPath, [
        '-y', '-i', input.filePath,
        '-ss', '00:00:01',
        '-vframes', '1',
        '-q:v', '2',
        posterPath,
      ]);
      posterFrame = await readFile(posterPath);
    } catch {
      posterFrame = Buffer.alloc(0);
    }

    return { metadata, posterFrame };
  }
}

export function createVideoProcessor(useMock = false): VideoProcessor {
  if (useMock || process.env.NODE_ENV === 'test') {
    return new MockVideoProcessor();
  }
  return new MockVideoProcessor(
    process.env.FFPROBE_PATH ?? 'ffprobe',
    process.env.FFMPEG_PATH ?? 'ffmpeg',
  );
}
