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
import { errorHandler } from './middleware/error-handler';
import { env } from './config/env';

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

  // Start server
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
