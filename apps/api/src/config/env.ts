import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_URL: z.string().default('http://localhost:4000'),
  WEB_URL: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string(),
  SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_KEY: z.string(),
  SUPABASE_JWT_SECRET: z.string(),
  REDIS_URL: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment variables:');
    console.error(parsed.error.format());

    // In development, provide helpful defaults
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Using placeholder values for development. Configure .env for full functionality.');
      return {
        NODE_ENV: 'development' as const,
        PORT: 4000,
        API_URL: 'http://localhost:4000',
        WEB_URL: 'http://localhost:3000',
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/vara?schema=public',
        SUPABASE_URL: 'https://placeholder.supabase.co',
        SUPABASE_SERVICE_KEY: 'placeholder-key',
        SUPABASE_JWT_SECRET: 'placeholder-secret',
        REDIS_URL: undefined,
      };
    }

    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

export const env = loadEnv();
