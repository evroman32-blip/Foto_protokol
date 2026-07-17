import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { resetEnvCache } from '@mandarin/config';
import { AppModule } from '../src/app.module';

describe('API integration', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://photoprotocol:photoprotocol@localhost:5432/photoprotocol?schema=public';
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-min-32-characters-long';
    process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'test-session-secret-min-32-chars';
    process.env.S3_ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
    process.env.S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID ?? 'minioadmin';
    process.env.S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY ?? 'minioadmin';
    process.env.S3_BUCKET = process.env.S3_BUCKET ?? 'photoprotocol';
    process.env.API_URL = process.env.API_URL ?? 'http://localhost:3001';
    process.env.WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
    process.env.STOMA1C_INTEGRATION_ENABLED = 'false';
    process.env.MIS_PROVIDER = 'none';

    resetEnvCache();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('GET /stoma1c/health returns disabled in standalone mode', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/stoma1c/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ enabled: false, status: 'disabled' });
  });

  it('POST /auth/login rejects invalid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'invalid@test.local', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toContain('Неверный');
  });
});
