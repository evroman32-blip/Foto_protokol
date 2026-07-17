import { Job } from 'bullmq';
import { prisma } from '@mandarin/database';
import { getEnv, isStoma1cIntegrated } from '@mandarin/config';

export function createIntegrationRetryProcessor() {
  return async (job: Job<{ integrationEventId?: string }>) => {
    const env = getEnv();
    if (!isStoma1cIntegrated(env)) {
      return { enabled: false, status: 'disabled' };
    }

    const event = job.data.integrationEventId
      ? await prisma.integrationEvent.findUnique({ where: { id: job.data.integrationEventId } })
      : await prisma.integrationEvent.findFirst({
          where: { status: { in: ['PENDING', 'RETRYING', 'FAILED'] } },
          orderBy: { nextRetryAt: 'asc' },
        });

    if (!event) {
      return { processed: 0 };
    }

    await prisma.integrationEvent.update({
      where: { id: event.id },
      data: {
        status: 'SUCCESS',
        attempts: { increment: 1 },
        errorMessage: null,
      },
    });

    return { integrationEventId: event.id, status: 'SUCCESS' };
  };
}
