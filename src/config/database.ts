import { PrismaClient } from '@prisma/client';
import { getEnv } from './env.js';

let prisma: PrismaClient;

export function getPrisma(): PrismaClient {
  if (prisma) return prisma;
  prisma = new PrismaClient({
    datasourceUrl: getEnv().DATABASE_URL,
    log: getEnv().NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}
