import { z } from 'zod';

function boolFromEnv(defaultValue = false) {
  return z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => {
      if (typeof v === 'boolean') return v;
      if (v === undefined || v === '') return defaultValue;
      return v === 'true' || v === '1';
    });
}

function listFromEnv(defaults: string[]) {
  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (Array.isArray(v)) return v;
      if (!v) return defaults;
      return v.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    });
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1).default('postgresql://photoprotocol:photoprotocol@localhost:5432/photoprotocol?schema=public'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(16).default('change-me-local-jwt-secret-min-32-chars'),
  SESSION_SECRET: z.string().min(16).default('change-me-local-session-secret-min-32'),

  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('photoprotocol'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: boolFromEnv(true),
  S3_PUBLIC_BASE_URL: z.string().optional().default(''),
  S3_PUBLIC_ENDPOINT: z.string().optional().default(''),

  MIS_PROVIDER: z.enum(['none', 'stoma1c']).default('none'),
  STOMA1C_INTEGRATION_ENABLED: boolFromEnv(false),
  STOMA1C_API_BASE_URL: z.string().optional().default(''),
  STOMA1C_API_TOKEN: z.string().optional().default(''),
  STOMA1C_DATABASE_ID: z.string().optional().default(''),

  AI_PROVIDER: z.enum(['mock', 'yandex']).default('mock'),
  YANDEX_AI_ENABLED: boolFromEnv(false),
  YANDEX_CLOUD_FOLDER_ID: z.string().optional().default(''),
  YANDEX_AI_MODEL_URI: z.string().optional().default(''),
  YANDEX_AI_FLASH_MODEL_URI: z.string().optional().default(''),
  YANDEX_DATA_LOGGING_ENABLED: boolFromEnv(false),
  YANDEX_AI_TIMEOUT_MS: z.coerce.number().default(60000),
  YANDEX_AI_MAX_RETRIES: z.coerce.number().default(3),
  YANDEX_MEDIA_CLASSIFIER_MODE: z
    .enum(['mock', 'yandex_multimodal', 'custom_cv'])
    .default('mock'),
  YANDEX_LOCKBOX_SECRET_ID: z.string().optional().default(''),
  YANDEX_IAM_TOKEN: z.string().optional().default(''),

  MAX_SINGLE_FILE_SIZE_MB: z.coerce.number().default(100),
  MAX_UPLOAD_CONCURRENCY: z.coerce.number().default(5),
  MAX_STORAGE_QUOTA_GB: z.coerce.number().default(500),
  ALLOWED_PHOTO_FORMATS: listFromEnv(['jpg', 'jpeg', 'png', 'tiff']),
  ALLOWED_VIDEO_FORMATS: listFromEnv(['mp4', 'mov']),
  ALLOWED_DOCUMENT_FORMATS: listFromEnv(['pdf']),
  ALLOWED_RADIOLOGY_FORMATS: listFromEnv(['jpg', 'jpeg', 'png', 'pdf', 'dcm', 'dicom', 'zip']),

  API_URL: z.string().default('http://localhost:3001'),
  WEB_URL: z.string().default('http://localhost:3000'),
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  WEB_PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  DEMO_PASSWORD: z.string().optional().default('ChangeMe123!'),
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
});

export type Env = z.infer<typeof envSchema> & {
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
};

let cachedEnv: Env | null = null;

export function getEnv(overrides?: Record<string, string | undefined>): Env {
  if (cachedEnv && !overrides) return cachedEnv;
  const merged: Record<string, string | undefined> = { ...process.env, ...overrides };
  if (!merged.S3_ACCESS_KEY_ID && merged.S3_ACCESS_KEY) merged.S3_ACCESS_KEY_ID = merged.S3_ACCESS_KEY;
  if (!merged.S3_SECRET_ACCESS_KEY && merged.S3_SECRET_KEY) {
    merged.S3_SECRET_ACCESS_KEY = merged.S3_SECRET_KEY;
  }
  merged.S3_ACCESS_KEY_ID = merged.S3_ACCESS_KEY_ID ?? 'minioadmin';
  merged.S3_SECRET_ACCESS_KEY = merged.S3_SECRET_ACCESS_KEY ?? 'minioadmin';

  const parsed = envSchema.parse(merged) as Env;
  parsed.S3_ACCESS_KEY_ID = merged.S3_ACCESS_KEY_ID!;
  parsed.S3_SECRET_ACCESS_KEY = merged.S3_SECRET_ACCESS_KEY!;
  if (!overrides) cachedEnv = parsed;
  return parsed;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}

export function isStandaloneMode(env: Env = getEnv()): boolean {
  return env.MIS_PROVIDER === 'none' && !env.STOMA1C_INTEGRATION_ENABLED;
}

export function isStoma1cIntegrated(env: Env = getEnv()): boolean {
  return env.MIS_PROVIDER === 'stoma1c' && !!env.STOMA1C_INTEGRATION_ENABLED;
}
