import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { getEnv } from '@mandarin/config';

export const QUEUE_NAMES = {
  PROCESS_MEDIA: 'process-media',
  GENERATE_DERIVATIVES: 'generate-derivatives',
  AI_CLASSIFY: 'ai-classify',
  INTEGRATION_RETRY: 'integration-retry',
  REPORT_GENERATION: 'report-generation',
} as const;

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection: IORedis;
  private readonly queues = new Map<string, Queue>();

  constructor() {
    const env = getEnv();
    this.connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }

  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      this.queues.set(
        name,
        new Queue(name, { connection: this.connection }),
      );
    }
    return this.queues.get(name)!;
  }

  async addJob(queueName: string, jobName: string, data: Record<string, unknown>) {
    const queue = this.getQueue(queueName);
    return queue.add(jobName, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }

  async onModuleDestroy() {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    await this.connection.quit();
  }
}
