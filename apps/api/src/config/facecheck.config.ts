import { z } from 'zod';

/**
 * FaceCheck.id Configuration
 *
 * Controls how the system performs facial recognition searches against public web sources
 * using the FaceCheck.id API to detect unauthorized use of protected images.
 */

// Configuration schema with validation
const faceCheckConfigSchema = z.object({
  /** FaceCheck engine: 'facecheck' to enable, 'off' to disable */
  engine: z.enum(['facecheck', 'off']).default('off'),

  /** FaceCheck.id API key */
  apiKey: z.string().optional(),

  /** Minimum similarity score threshold (0-100) to consider a match */
  minScoreThreshold: z.coerce.number().min(0).max(100).default(70),

  /** Whether to run in demo mode (uses FaceCheck.id demo endpoint) */
  demoMode: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(true),

  /** Base URL for the FaceCheck.id API (must be HTTPS) */
  apiBaseUrl: z.string().url().refine(
    (url) => url.startsWith('https://'),
    { message: 'FaceCheck API base URL must use HTTPS' },
  ).default('https://facecheck.id'),

  /** Polling interval in milliseconds when waiting for search results */
  pollIntervalMs: z.coerce.number().min(1000).max(30000).default(3000),

  /** Maximum total polling time in milliseconds before timing out */
  maxPollTimeMs: z.coerce.number().min(30000).max(900000).default(600000),
});

export type FaceCheckConfig = z.infer<typeof faceCheckConfigSchema>;

/**
 * Load and validate FaceCheck configuration from environment variables
 */
export function getFaceCheckConfig(): FaceCheckConfig {
  const rawConfig = {
    engine: process.env.FACECHECK_ENGINE || 'off',
    apiKey: process.env.FACECHECK_API_KEY,
    minScoreThreshold: process.env.FACECHECK_MIN_SCORE || '70',
    demoMode: process.env.FACECHECK_DEMO || 'true',
    apiBaseUrl: process.env.FACECHECK_API_URL || 'https://facecheck.id',
    pollIntervalMs: process.env.FACECHECK_POLL_INTERVAL || '3000',
    maxPollTimeMs: process.env.FACECHECK_MAX_POLL_TIME || '600000',
  };

  const parsed = faceCheckConfigSchema.safeParse(rawConfig);

  if (!parsed.success) {
    console.error('Invalid FaceCheck configuration:');
    console.error(parsed.error.format());

    // Return safe defaults if parsing fails
    return {
      engine: 'off',
      apiKey: undefined,
      minScoreThreshold: 70,
      demoMode: true,
      apiBaseUrl: 'https://facecheck.id',
      pollIntervalMs: 3000,
      maxPollTimeMs: 600000,
    };
  }

  return parsed.data;
}

/**
 * Check if FaceCheck is enabled and properly configured
 *
 * Returns true only if:
 * 1. Engine is not 'off'
 * 2. API key is set
 */
export function isFaceCheckEnabled(): boolean {
  const config = getFaceCheckConfig();
  return config.engine !== 'off' && Boolean(config.apiKey);
}

/**
 * Get a human-readable status of FaceCheck configuration
 */
export function getFaceCheckStatus(): {
  enabled: boolean;
  engine: string;
  reason?: string;
  demoMode: boolean;
} {
  const config = getFaceCheckConfig();

  if (config.engine === 'off') {
    return {
      enabled: false,
      engine: 'off',
      reason: 'FaceCheck is disabled (FACECHECK_ENGINE=off)',
      demoMode: config.demoMode,
    };
  }

  if (!config.apiKey) {
    return {
      enabled: false,
      engine: config.engine,
      reason: 'FaceCheck API key not configured (FACECHECK_API_KEY is missing)',
      demoMode: config.demoMode,
    };
  }

  return {
    enabled: true,
    engine: config.engine,
    demoMode: config.demoMode,
  };
}

// Export singleton config instance for convenience
let _configInstance: FaceCheckConfig | null = null;

export function getConfig(): FaceCheckConfig {
  if (!_configInstance) {
    _configInstance = getFaceCheckConfig();
  }
  return _configInstance;
}

/**
 * Reset the cached config instance (useful for testing)
 */
export function resetFaceCheckConfigCache(): void {
  _configInstance = null;
}
