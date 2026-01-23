// Load environment variables from .env file BEFORE any other imports
import 'dotenv/config';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { onboardingRoutes } from './routes/onboarding';
import { imageRoutes } from './routes/images';
import { alertRoutes } from './routes/alerts';
import { protectionPlanRoutes } from './routes/protection-plan';
import { scanRoutes } from './routes/scans';
import { matchRoutes } from './routes/matches';
import { errorHandler } from './middleware/error-handler';
import { env } from './config/env';
import { closeQueues } from './queues';
import { initializeWorkers, shutdownWorkers } from './workers/init';
import { closeRedisConnection } from './config/redis';

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
            },
          }
        : undefined,
  },
});

// Custom JSON body parser that handles empty bodies gracefully
// Fixes: FST_ERR_CTP_EMPTY_JSON_BODY - Body cannot be empty when content-type is set to 'application/json'
app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
  try {
    // If body is empty string or null/undefined, default to empty object
    const parsedBody = body && typeof body === 'string' && body.trim() ? JSON.parse(body) : {};
    done(null, parsedBody);
  } catch (err) {
    done(err as Error, undefined);
  }
});

async function start() {
  // Register plugins
  await app.register(cors, {
    origin: env.WEB_URL,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Multipart support for file uploads (10MB limit)
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 1, // Only allow one file per request
    },
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // API routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(userRoutes, { prefix: '/api/v1/users' });
  await app.register(onboardingRoutes, { prefix: '/api/v1/onboarding' });
  await app.register(imageRoutes, { prefix: '/api/v1/images' });
  await app.register(alertRoutes, { prefix: '/api/v1/alerts' });
  await app.register(protectionPlanRoutes, { prefix: '/api/v1/protection-plan' });
  await app.register(scanRoutes, { prefix: '/api/v1/scans' });
  await app.register(matchRoutes, { prefix: '/api/v1/matches' });

  // Initialize workers if Redis is configured
  if (env.REDIS_URL) {
    initializeWorkers();
    app.log.info('Background workers initialized');
  } else {
    app.log.warn('REDIS_URL not configured - background workers disabled');
  }

  // Start server
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler.
 * Closes all connections in proper order.
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Server] Received ${signal}, starting graceful shutdown...`);

  try {
    // 1. Close Fastify server (stop accepting new requests)
    await app.close();
    console.log('[Server] Fastify server closed');

    // 2. Shutdown workers (wait for in-progress jobs)
    await shutdownWorkers();
    console.log('[Server] Workers shut down');

    // 3. Close queue connections
    await closeQueues();
    console.log('[Server] Queues closed');

    // 4. Close Redis connection
    await closeRedisConnection();
    console.log('[Server] Redis connection closed');

    console.log('[Server] Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('[Server] Error during shutdown:', error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
