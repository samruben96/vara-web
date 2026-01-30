import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
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

// Create pg Pool using the pooled DATABASE_URL for runtime connections
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: getLogConfig(),
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
