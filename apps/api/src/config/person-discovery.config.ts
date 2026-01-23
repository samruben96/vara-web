import { z } from 'zod';

/**
 * Person Discovery Configuration
 *
 * Controls how the system discovers person identity candidates from protected images
 * using SerpAPI (Google Lens / Google Reverse Image / Bing reverse image search) and expands searches via TinEye.
 */

// Valid provider types for person discovery
const providerSchema = z.enum(['google_lens', 'google_reverse_image', 'bing_reverse_image']);
export type PersonDiscoveryProvider = z.infer<typeof providerSchema>;

// Configuration schema with validation
const personDiscoveryConfigSchema = z.object({
  /** Discovery engine: 'serpapi' to enable, 'off' to disable */
  engine: z.enum(['serpapi', 'off']).default('serpapi'),

  /** SerpAPI API key for Google Lens, Google Reverse Image, and Bing reverse image search */
  serpApiKey: z.string().optional(),

  /** Maximum candidates to fetch from SerpAPI per search */
  maxCandidates: z.coerce.number().min(1).max(100).default(20),

  /** Provider order for person discovery (first is primary, rest are fallbacks) */
  providerOrder: z.array(providerSchema).default(['google_lens', 'google_reverse_image', 'bing_reverse_image']),

  /** Maximum TinEye expansion searches per scan */
  maxTineyeExpansions: z.coerce.number().min(0).max(50).default(10),

  /** Cache TTL for SerpAPI results in seconds */
  cacheTtl: z.coerce.number().min(0).default(86400), // 24 hours
});

export type PersonDiscoveryConfig = z.infer<typeof personDiscoveryConfigSchema>;

/**
 * Parse provider order from comma-separated string
 */
function parseProviderOrder(value: string | undefined): PersonDiscoveryProvider[] {
  if (!value) {
    return ['google_lens', 'google_reverse_image', 'bing_reverse_image'];
  }

  const providers = value
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p === 'google_lens' || p === 'google_reverse_image' || p === 'bing_reverse_image') as PersonDiscoveryProvider[];

  return providers.length > 0 ? providers : ['google_lens', 'google_reverse_image', 'bing_reverse_image'];
}

/**
 * Load and validate person discovery configuration from environment variables
 */
export function getPersonDiscoveryConfig(): PersonDiscoveryConfig {
  const rawConfig = {
    engine: process.env.PERSON_DISCOVERY_ENGINE || 'serpapi',
    serpApiKey: process.env.SERPAPI_API_KEY,
    maxCandidates: process.env.PERSON_DISCOVERY_MAX_CANDIDATES || '20',
    providerOrder: parseProviderOrder(process.env.PERSON_DISCOVERY_PROVIDER_ORDER),
    maxTineyeExpansions: process.env.MAX_TINEYE_EXPANSIONS || '10',
    cacheTtl: process.env.SERPAPI_CACHE_TTL || '86400',
  };

  const parsed = personDiscoveryConfigSchema.safeParse(rawConfig);

  if (!parsed.success) {
    console.error('Invalid person discovery configuration:');
    console.error(parsed.error.format());

    // Return safe defaults if parsing fails
    return {
      engine: 'off',
      serpApiKey: undefined,
      maxCandidates: 20,
      providerOrder: ['google_lens', 'google_reverse_image', 'bing_reverse_image'],
      maxTineyeExpansions: 10,
      cacheTtl: 86400,
    };
  }

  return parsed.data;
}

/**
 * Check if person discovery is enabled and properly configured
 *
 * Returns true only if:
 * 1. Engine is not 'off'
 * 2. SerpAPI key is set
 */
export function isPersonDiscoveryEnabled(): boolean {
  const config = getPersonDiscoveryConfig();
  return config.engine !== 'off' && Boolean(config.serpApiKey);
}

/**
 * Get a human-readable status of person discovery configuration
 */
export function getPersonDiscoveryStatus(): {
  enabled: boolean;
  engine: string;
  reason?: string;
} {
  const config = getPersonDiscoveryConfig();

  if (config.engine === 'off') {
    return {
      enabled: false,
      engine: 'off',
      reason: 'Person discovery is disabled (PERSON_DISCOVERY_ENGINE=off)',
    };
  }

  if (!config.serpApiKey) {
    return {
      enabled: false,
      engine: config.engine,
      reason: 'SerpAPI key not configured (SERPAPI_API_KEY is missing)',
    };
  }

  return {
    enabled: true,
    engine: config.engine,
  };
}

// Export singleton config instance for convenience
let _configInstance: PersonDiscoveryConfig | null = null;

export function getConfig(): PersonDiscoveryConfig {
  if (!_configInstance) {
    _configInstance = getPersonDiscoveryConfig();
  }
  return _configInstance;
}

/**
 * Reset the cached config instance (useful for testing)
 */
export function resetConfigCache(): void {
  _configInstance = null;
}
