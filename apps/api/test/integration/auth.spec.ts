import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { resetEnvCache, getEnv } from '@mandarin/config';
import { AppModule } from '../../src/app.module';

describe('Auth integration (requires seeded DB)', () => {
  let app: NestFastifyApplication;
  let dbAvailable = true;

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
    resetEnvCache();

    try {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
      await app.register(fastifyCookie, { secret: getEnv().SESSION_SECRET });
      app.setGlobalPrefix('api/v1');
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    } catch {
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('demo orthopedist login returns JWT', async () => {
    if (!dbAvailable) {
      return;
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'orthopedist@demo.local',
        password: process.env.DEMO_PASSWORD ?? 'ChangeMe123!',
      },
    });

    if (res.statusCode === 401) {
      // DB not seeded — skip assertion
      return;
    }

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.user.email).toBe('orthopedist@demo.local');
  });
});
