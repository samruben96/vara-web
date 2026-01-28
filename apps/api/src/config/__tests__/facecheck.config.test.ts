/**
 * FaceCheck.id Configuration Unit Tests
 *
 * Comprehensive tests for the FaceCheck configuration module, covering:
 * - Environment variable parsing and defaults
 * - Zod schema validation (coercion, preprocessing, range constraints)
 * - isFaceCheckEnabled() logic
 * - getFaceCheckStatus() human-readable output
 * - getConfig() singleton caching and resetFaceCheckConfigCache()
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getFaceCheckConfig,
  isFaceCheckEnabled,
  getFaceCheckStatus,
  getConfig,
  resetFaceCheckConfigCache,
} from '../facecheck.config';
import type { FaceCheckConfig } from '../facecheck.config';

// Suppress console output during tests (the config module logs on parse errors)
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

// Snapshot of original env so we can restore after each test
const originalEnv = { ...process.env };

/**
 * Helper: set all FaceCheck env vars from a partial map.
 * Keys are the short names (e.g. 'ENGINE'), values are strings.
 */
function setFaceCheckEnv(vars: Record<string, string>): void {
  const envMap: Record<string, string> = {
    ENGINE: 'FACECHECK_ENGINE',
    API_KEY: 'FACECHECK_API_KEY',
    MIN_SCORE: 'FACECHECK_MIN_SCORE',
    DEMO: 'FACECHECK_DEMO',
    API_URL: 'FACECHECK_API_URL',
    POLL_INTERVAL: 'FACECHECK_POLL_INTERVAL',
    MAX_POLL_TIME: 'FACECHECK_MAX_POLL_TIME',
  };
  for (const [key, value] of Object.entries(vars)) {
    const envKey = envMap[key];
    if (envKey) {
      process.env[envKey] = value;
    }
  }
}

beforeEach(() => {
  // Clear all FaceCheck env vars to ensure isolation
  delete process.env.FACECHECK_ENGINE;
  delete process.env.FACECHECK_API_KEY;
  delete process.env.FACECHECK_MIN_SCORE;
  delete process.env.FACECHECK_DEMO;
  delete process.env.FACECHECK_API_URL;
  delete process.env.FACECHECK_POLL_INTERVAL;
  delete process.env.FACECHECK_MAX_POLL_TIME;
  resetFaceCheckConfigCache();
});

afterEach(() => {
  process.env = { ...originalEnv };
  resetFaceCheckConfigCache();
});

// =====================================================================
// getFaceCheckConfig
// =====================================================================
describe('getFaceCheckConfig', () => {
  describe('default values', () => {
    it('returns engine "off" when FACECHECK_ENGINE is not set', () => {
      const config = getFaceCheckConfig();
      expect(config.engine).toBe('off');
    });

    it('returns minScoreThreshold of 70 by default', () => {
      const config = getFaceCheckConfig();
      expect(config.minScoreThreshold).toBe(70);
    });

    it('returns demoMode true by default', () => {
      const config = getFaceCheckConfig();
      expect(config.demoMode).toBe(true);
    });

    it('returns apiBaseUrl "https://facecheck.id" by default', () => {
      const config = getFaceCheckConfig();
      expect(config.apiBaseUrl).toBe('https://facecheck.id');
    });

    it('returns pollIntervalMs of 3000 by default', () => {
      const config = getFaceCheckConfig();
      expect(config.pollIntervalMs).toBe(3000);
    });

    it('returns maxPollTimeMs of 300000 by default', () => {
      const config = getFaceCheckConfig();
      expect(config.maxPollTimeMs).toBe(300000);
    });

    it('returns apiKey as undefined when not set', () => {
      const config = getFaceCheckConfig();
      expect(config.apiKey).toBeUndefined();
    });
  });

  describe('reading environment variables', () => {
    it('reads FACECHECK_ENGINE as "facecheck"', () => {
      setFaceCheckEnv({ ENGINE: 'facecheck' });
      const config = getFaceCheckConfig();
      expect(config.engine).toBe('facecheck');
    });

    it('reads FACECHECK_ENGINE as "off"', () => {
      setFaceCheckEnv({ ENGINE: 'off' });
      const config = getFaceCheckConfig();
      expect(config.engine).toBe('off');
    });

    it('reads FACECHECK_API_KEY', () => {
      setFaceCheckEnv({ API_KEY: 'fc-secret-key-123' });
      const config = getFaceCheckConfig();
      expect(config.apiKey).toBe('fc-secret-key-123');
    });

    it('coerces FACECHECK_MIN_SCORE from string to number', () => {
      setFaceCheckEnv({ MIN_SCORE: '85' });
      const config = getFaceCheckConfig();
      expect(config.minScoreThreshold).toBe(85);
      expect(typeof config.minScoreThreshold).toBe('number');
    });

    it('reads FACECHECK_DEMO "true" as boolean true', () => {
      setFaceCheckEnv({ DEMO: 'true' });
      const config = getFaceCheckConfig();
      expect(config.demoMode).toBe(true);
    });

    it('reads FACECHECK_DEMO "false" as boolean false', () => {
      setFaceCheckEnv({ DEMO: 'false' });
      const config = getFaceCheckConfig();
      expect(config.demoMode).toBe(false);
    });

    it('reads FACECHECK_API_URL', () => {
      setFaceCheckEnv({ API_URL: 'https://custom.facecheck.io' });
      const config = getFaceCheckConfig();
      expect(config.apiBaseUrl).toBe('https://custom.facecheck.io');
    });

    it('coerces FACECHECK_POLL_INTERVAL from string to number', () => {
      setFaceCheckEnv({ POLL_INTERVAL: '5000' });
      const config = getFaceCheckConfig();
      expect(config.pollIntervalMs).toBe(5000);
      expect(typeof config.pollIntervalMs).toBe('number');
    });

    it('coerces FACECHECK_MAX_POLL_TIME from string to number', () => {
      setFaceCheckEnv({ MAX_POLL_TIME: '120000' });
      const config = getFaceCheckConfig();
      expect(config.maxPollTimeMs).toBe(120000);
      expect(typeof config.maxPollTimeMs).toBe('number');
    });
  });

  describe('validation and fallbacks', () => {
    it('falls back to safe defaults when FACECHECK_ENGINE has an invalid value', () => {
      // "invalid_engine" is not in the enum ['facecheck', 'off']
      process.env.FACECHECK_ENGINE = 'invalid_engine';
      const config = getFaceCheckConfig();
      // The safeParse fails, so the fallback defaults are returned
      expect(config.engine).toBe('off');
      expect(config.minScoreThreshold).toBe(70);
      expect(config.demoMode).toBe(true);
    });

    it('falls back to safe defaults when FACECHECK_MIN_SCORE is out of range (> 100)', () => {
      setFaceCheckEnv({ MIN_SCORE: '150' });
      const config = getFaceCheckConfig();
      // Zod .max(100) constraint fails, safeParse returns error, fallback used
      expect(config.minScoreThreshold).toBe(70);
      expect(config.engine).toBe('off');
    });

    it('falls back to safe defaults when FACECHECK_MIN_SCORE is negative', () => {
      setFaceCheckEnv({ MIN_SCORE: '-10' });
      const config = getFaceCheckConfig();
      expect(config.minScoreThreshold).toBe(70);
    });

    it('falls back to safe defaults when FACECHECK_POLL_INTERVAL is below 1000', () => {
      setFaceCheckEnv({ POLL_INTERVAL: '500' });
      const config = getFaceCheckConfig();
      // .min(1000) fails, fallback
      expect(config.pollIntervalMs).toBe(3000);
    });

    it('falls back to safe defaults when FACECHECK_POLL_INTERVAL exceeds 30000', () => {
      setFaceCheckEnv({ POLL_INTERVAL: '60000' });
      const config = getFaceCheckConfig();
      expect(config.pollIntervalMs).toBe(3000);
    });

    it('falls back to safe defaults when FACECHECK_MAX_POLL_TIME is below 30000', () => {
      setFaceCheckEnv({ MAX_POLL_TIME: '5000' });
      const config = getFaceCheckConfig();
      expect(config.maxPollTimeMs).toBe(300000);
    });

    it('falls back to safe defaults when FACECHECK_MAX_POLL_TIME exceeds 600000', () => {
      setFaceCheckEnv({ MAX_POLL_TIME: '999999' });
      const config = getFaceCheckConfig();
      expect(config.maxPollTimeMs).toBe(300000);
    });

    it('logs errors to console.error on schema failure', () => {
      process.env.FACECHECK_ENGINE = 'bogus_value';
      vi.mocked(console.error).mockClear();

      getFaceCheckConfig();

      expect(console.error).toHaveBeenCalled();
    });
  });
});

// =====================================================================
// isFaceCheckEnabled
// =====================================================================
describe('isFaceCheckEnabled', () => {
  it('returns false with default config (engine=off, no API key)', () => {
    expect(isFaceCheckEnabled()).toBe(false);
  });

  it('returns false when engine=facecheck but no API key is set', () => {
    setFaceCheckEnv({ ENGINE: 'facecheck' });
    expect(isFaceCheckEnabled()).toBe(false);
  });

  it('returns true when engine=facecheck AND API key is set', () => {
    setFaceCheckEnv({ ENGINE: 'facecheck', API_KEY: 'fc-key-abc' });
    expect(isFaceCheckEnabled()).toBe(true);
  });

  it('returns false when engine=off AND API key is set', () => {
    setFaceCheckEnv({ ENGINE: 'off', API_KEY: 'fc-key-abc' });
    expect(isFaceCheckEnabled()).toBe(false);
  });

  it('returns false when API key is an empty string', () => {
    setFaceCheckEnv({ ENGINE: 'facecheck', API_KEY: '' });
    // Boolean('') is false
    expect(isFaceCheckEnabled()).toBe(false);
  });
});

// =====================================================================
// getFaceCheckStatus
// =====================================================================
describe('getFaceCheckStatus', () => {
  it('returns disabled status with reason when engine=off', () => {
    setFaceCheckEnv({ ENGINE: 'off' });
    const status = getFaceCheckStatus();
    expect(status.enabled).toBe(false);
    expect(status.engine).toBe('off');
    expect(status.reason).toBeDefined();
    expect(status.reason).toContain('disabled');
  });

  it('returns disabled status with reason when API key is missing', () => {
    setFaceCheckEnv({ ENGINE: 'facecheck' });
    // No API key set
    const status = getFaceCheckStatus();
    expect(status.enabled).toBe(false);
    expect(status.engine).toBe('facecheck');
    expect(status.reason).toBeDefined();
    expect(status.reason).toContain('API key');
  });

  it('returns enabled status when properly configured', () => {
    setFaceCheckEnv({ ENGINE: 'facecheck', API_KEY: 'fc-valid-key' });
    const status = getFaceCheckStatus();
    expect(status.enabled).toBe(true);
    expect(status.engine).toBe('facecheck');
    expect(status.reason).toBeUndefined();
  });

  it('always includes demoMode in the status', () => {
    const statusOff = getFaceCheckStatus();
    expect(statusOff).toHaveProperty('demoMode');

    setFaceCheckEnv({ ENGINE: 'facecheck', API_KEY: 'fc-key', DEMO: 'false' });
    resetFaceCheckConfigCache();
    const statusOn = getFaceCheckStatus();
    expect(statusOn).toHaveProperty('demoMode');
    expect(statusOn.demoMode).toBe(false);
  });

  it('reflects demoMode=true when FACECHECK_DEMO is "true"', () => {
    setFaceCheckEnv({ ENGINE: 'facecheck', API_KEY: 'fc-key', DEMO: 'true' });
    const status = getFaceCheckStatus();
    expect(status.demoMode).toBe(true);
  });

  it('includes the correct engine field value', () => {
    setFaceCheckEnv({ ENGINE: 'facecheck', API_KEY: 'fc-key' });
    const status = getFaceCheckStatus();
    expect(status.engine).toBe('facecheck');
  });
});

// =====================================================================
// getConfig / resetFaceCheckConfigCache (singleton caching)
// =====================================================================
describe('getConfig and resetFaceCheckConfigCache', () => {
  it('returns a valid FaceCheckConfig object', () => {
    const config = getConfig();
    expect(config).toHaveProperty('engine');
    expect(config).toHaveProperty('minScoreThreshold');
    expect(config).toHaveProperty('demoMode');
    expect(config).toHaveProperty('apiBaseUrl');
    expect(config).toHaveProperty('pollIntervalMs');
    expect(config).toHaveProperty('maxPollTimeMs');
  });

  it('returns the same cached instance on subsequent calls', () => {
    const config1 = getConfig();
    const config2 = getConfig();
    // Strict reference equality: same object in memory
    expect(config1).toBe(config2);
  });

  it('returns a fresh config after resetFaceCheckConfigCache is called', () => {
    // First call caches the default config (engine=off)
    const configBefore = getConfig();
    expect(configBefore.engine).toBe('off');

    // Change env and reset cache
    setFaceCheckEnv({ ENGINE: 'facecheck', API_KEY: 'fc-new-key' });
    resetFaceCheckConfigCache();

    // Second call should pick up the new env vars
    const configAfter = getConfig();
    expect(configAfter.engine).toBe('facecheck');
    expect(configAfter.apiKey).toBe('fc-new-key');
  });

  it('does not reflect env changes without resetting the cache', () => {
    const configBefore = getConfig();
    expect(configBefore.engine).toBe('off');

    // Change env without resetting cache
    setFaceCheckEnv({ ENGINE: 'facecheck' });

    const configStale = getConfig();
    // Should still be the cached value
    expect(configStale.engine).toBe('off');
    expect(configStale).toBe(configBefore);
  });
});

// =====================================================================
// Zod validation edge cases
// =====================================================================
describe('Zod schema edge cases', () => {
  it('preprocesses string "true" for demoMode to boolean true', () => {
    setFaceCheckEnv({ DEMO: 'true' });
    const config = getFaceCheckConfig();
    expect(config.demoMode).toBe(true);
    expect(typeof config.demoMode).toBe('boolean');
  });

  it('preprocesses string "false" for demoMode to boolean false', () => {
    // The preprocess function: val === 'true' || val === true
    // "false" does not match either condition, so it becomes false
    setFaceCheckEnv({ DEMO: 'false' });
    const config = getFaceCheckConfig();
    expect(config.demoMode).toBe(false);
    expect(typeof config.demoMode).toBe('boolean');
  });

  it('coerces number-like strings for all numeric fields', () => {
    setFaceCheckEnv({
      MIN_SCORE: '42',
      POLL_INTERVAL: '2500',
      MAX_POLL_TIME: '60000',
    });
    const config = getFaceCheckConfig();
    expect(config.minScoreThreshold).toBe(42);
    expect(config.pollIntervalMs).toBe(2500);
    expect(config.maxPollTimeMs).toBe(60000);
    // Ensure they are actual numbers, not strings
    expect(typeof config.minScoreThreshold).toBe('number');
    expect(typeof config.pollIntervalMs).toBe('number');
    expect(typeof config.maxPollTimeMs).toBe('number');
  });

  it('accepts boundary value 0 for minScoreThreshold', () => {
    setFaceCheckEnv({ MIN_SCORE: '0' });
    const config = getFaceCheckConfig();
    expect(config.minScoreThreshold).toBe(0);
  });

  it('accepts boundary value 100 for minScoreThreshold', () => {
    setFaceCheckEnv({ MIN_SCORE: '100' });
    const config = getFaceCheckConfig();
    expect(config.minScoreThreshold).toBe(100);
  });

  it('accepts boundary value 1000 for pollIntervalMs', () => {
    setFaceCheckEnv({ POLL_INTERVAL: '1000' });
    const config = getFaceCheckConfig();
    expect(config.pollIntervalMs).toBe(1000);
  });

  it('accepts boundary value 30000 for pollIntervalMs', () => {
    setFaceCheckEnv({ POLL_INTERVAL: '30000' });
    const config = getFaceCheckConfig();
    expect(config.pollIntervalMs).toBe(30000);
  });

  it('accepts boundary value 30000 for maxPollTimeMs', () => {
    setFaceCheckEnv({ MAX_POLL_TIME: '30000' });
    const config = getFaceCheckConfig();
    expect(config.maxPollTimeMs).toBe(30000);
  });

  it('accepts boundary value 600000 for maxPollTimeMs', () => {
    setFaceCheckEnv({ MAX_POLL_TIME: '600000' });
    const config = getFaceCheckConfig();
    expect(config.maxPollTimeMs).toBe(600000);
  });
});
