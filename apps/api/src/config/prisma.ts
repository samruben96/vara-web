import { PrismaClient } from '@prisma/client';
import { env } from './env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Build log configuration based on environment
// Query logging is disabled by default to reduce noise, enable with PRISMA_LOG_QUERIES=true
const getLogConfig = (): ('query' | 'error' | 'warn' | 'info')[] => {
  const logs: ('query' | 'error' | 'warn' | 'info')[] = ['error'];

  if (env.NODE_ENV === 'development') {
    logs.push('warn');
  }

  // Only enable query logging when explicitly requested
  if (env.PRISMA_LOG_QUERIES) {
    logs.push('query');
  }

  return logs;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: getLogConfig(),
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
