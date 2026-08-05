import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';

// Prisma BigInt (e.g. MediaAsset.fileSizeBytes) must be JSON-serializable
(BigInt.prototype as unknown as { toJSON?: () => string }).toJSON = function toJSON() {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true, bodyLimit: 210 * 1024 * 1024 }),
  );

  await app.register(cookie as never, {
    secret: process.env.SESSION_SECRET ?? 'local-dev-session-secret-min-16',
  });
  await app.register(multipart as never, {
    limits: { fileSize: 200 * 1024 * 1024 },
  });

  app.setGlobalPrefix('api/v1');
  const isDev = (process.env.NODE_ENV ?? 'development') !== 'production';
  const configuredOrigins = (process.env.CORS_ORIGIN ?? process.env.WEB_URL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    // In development reflect any Origin (localhost vs 127.0.0.1 are different browser origins).
    // In production use explicit WEB_URL / CORS_ORIGIN list.
    origin: isDev
      ? true
      : configuredOrigins.length > 0
        ? configuredOrigins
        : 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Mandarin PhotoProtocol API')
    .setDescription('Клинический quality gate Strategic Implant® / Corticobasal®')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Mandarin API: http://localhost:${port}/api/v1`);
  // eslint-disable-next-line no-console
  console.log(`Swagger: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
