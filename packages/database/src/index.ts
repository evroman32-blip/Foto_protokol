import { PrismaClient } from '@prisma/client';

export { PrismaClient };
export * from '@prisma/client';

export function createPrismaClient() {
  return new PrismaClient();
}

// Один клиент на процесс: воркер импортирует `prisma` во всех обработчиках,
// и переподключение на каждую задачу исчерпывает пул соединений Postgres.
const globalForPrisma = globalThis as typeof globalThis & {
  __mandarinPrisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.__mandarinPrisma ?? createPrismaClient();

globalForPrisma.__mandarinPrisma = prisma;
