import { PrismaClient } from '@prisma/client';

export { PrismaClient };
export * from '@prisma/client';

export function createPrismaClient() {
  return new PrismaClient();
}
