import IORedis from 'ioredis';
import { Worker } from 'bullmq';
import { getEnv } from '@mandarin/config';
import { prisma } from '@mandarin/database';
import { createProcessMediaProcessor } from './processors/process-media.processor';
import { createGenerateDerivativesProcessor } from './processors/generate-derivatives.processor';
import { createAiClassifyProcessor } from './processors/ai-classify.processor';
import { createIntegrationRetryProcessor } from './processors/integration-retry.processor';
import { createReportGenerationProcessor } from './processors/report-generation.processor';
import { QUEUE_NAMES } from './queue-names';

async function main() {
  const env = getEnv();
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const workers: Worker[] = [
    new Worker(QUEUE_NAMES.PROCESS_MEDIA, createProcessMediaProcessor(), { connection, concurrency: env.WORKER_CONCURRENCY }),
    new Worker(QUEUE_NAMES.GENERATE_DERIVATIVES, createGenerateDerivativesProcessor(), { connection, concurrency: env.WORKER_CONCURRENCY }),
    new Worker(QUEUE_NAMES.AI_CLASSIFY, createAiClassifyProcessor(), { connection, concurrency: 2 }),
    new Worker(QUEUE_NAMES.INTEGRATION_RETRY, createIntegrationRetryProcessor(), { connection, concurrency: 1 }),
    new Worker(QUEUE_NAMES.REPORT_GENERATION, createReportGenerationProcessor(), { connection, concurrency: 2 }),
  ];

  for (const worker of workers) {
    worker.on('failed', (job, err) => {
      console.error(`Задача ${job?.name} провалилась:`, err.message);
    });
  }

  console.log('Worker запущен, очереди:', Object.values(QUEUE_NAMES).join(', '));

  const shutdown = async () => {
    await Promise.all(workers.map((w) => w.close()));
    await connection.quit();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Ошибка запуска worker:', err);
  process.exit(1);
});
