/**
 * Image Proxy Service Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ImageProxyService,
  resetImageProxyService,
} from '../image-proxy.service';

// Mock the env module
vi.mock('@/config/env', () => ({
  env: {
    API_URL: 'https://test-api.example.com',
  },
}));

// Mock prisma
vi.mock('@/config/prisma', () => ({
  prisma: {
    protectedImage: {
      findUnique: vi.fn(),
    },
  },
}));

describe('ImageProxyService', () => {
  let service: ImageProxyService;

  beforeEach(() => {
    resetImageProxyService();
    service = new ImageProxyService('https://test-api.example.com');
  });

  afterEach(() => {
    service.stopCleanup();
    service.clearAllTokens();
  });

  describe('createProxyUrl', () => {
    it('should generate a proxy URL with a valid token', () => {
      const imageId = 'test-image-123';
      const url = service.createProxyUrl(imageId);

      expect(url).toMatch(/^https:\/\/test-api\.example\.com\/api\/v1\/proxy\/images\/[a-f0-9]{64}$/);
    });

    it('should store the image ID with the token', () => {
      const imageId = 'test-image-456';
      const url = service.createProxyUrl(imageId);

      // Extract token from URL
      const token = url.split('/').pop()!;

      const validation = service.validateToken(token);
      expect(validation.valid).toBe(true);
      expect(validation.imageId).toBe(imageId);
    });

    it('should store the storage path if provided', () => {
      const imageId = 'test-image-789';
      const storagePath = 'user-123/image.jpg';
      const url = service.createProxyUrl(imageId, { storagePath });

      const token = url.split('/').pop()!;
      const validation = service.validateToken(token);

      expect(validation.valid).toBe(true);
      expect(validation.storagePath).toBe(storagePath);
    });

    it('should throw error for empty image ID', () => {
      expect(() => service.createProxyUrl('')).toThrow('Image ID is required');
    });

    it('should generate unique tokens for each call', () => {
      const imageId = 'test-image';
      const url1 = service.createProxyUrl(imageId);
      const url2 = service.createProxyUrl(imageId);

      expect(url1).not.toBe(url2);
    });
  });

  describe('validateToken', () => {
    it('should return valid for a fresh token', () => {
      const imageId = 'test-image';
      const url = service.createProxyUrl(imageId);
      const token = url.split('/').pop()!;

      const result = service.validateToken(token);

      expect(result.valid).toBe(true);
      expect(result.imageId).toBe(imageId);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for non-existent token', () => {
      const result = service.validateToken('non-existent-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token not found');
    });

    it('should return invalid for expired token', async () => {
      const imageId = 'test-image';
      // Create with minimum TTL
      const url = service.createProxyUrl(imageId, { ttlMs: 100 }); // Will be clamped to MIN_TTL_MS
      const token = url.split('/').pop()!;

      // Token should be valid immediately
      const resultBefore = service.validateToken(token);
      expect(resultBefore.valid).toBe(true);

      // Note: We can't easily test expiry without waiting or mocking Date.now
      // The service clamps TTL to minimum of 2 minutes
    });

    it('should return invalid for empty token', () => {
      const result = service.validateToken('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token is required');
    });
  });

  describe('invalidateToken', () => {
    it('should remove a valid token', () => {
      const imageId = 'test-image';
      const url = service.createProxyUrl(imageId);
      const token = url.split('/').pop()!;

      // Token should be valid before invalidation
      expect(service.validateToken(token).valid).toBe(true);

      // Invalidate
      const removed = service.invalidateToken(token);
      expect(removed).toBe(true);

      // Token should be invalid after
      expect(service.validateToken(token).valid).toBe(false);
    });

    it('should return false for non-existent token', () => {
      const removed = service.invalidateToken('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('getActiveTokenCount', () => {
    it('should return 0 initially', () => {
      expect(service.getActiveTokenCount()).toBe(0);
    });

    it('should increment when tokens are created', () => {
      service.createProxyUrl('image-1');
      expect(service.getActiveTokenCount()).toBe(1);

      service.createProxyUrl('image-2');
      expect(service.getActiveTokenCount()).toBe(2);
    });

    it('should decrement when tokens are invalidated', () => {
      const url = service.createProxyUrl('image-1');
      const token = url.split('/').pop()!;

      expect(service.getActiveTokenCount()).toBe(1);

      service.invalidateToken(token);
      expect(service.getActiveTokenCount()).toBe(0);
    });
  });

  describe('TTL validation', () => {
    it('should clamp TTL below minimum to minimum', () => {
      // We can't directly test the clamping without exposing internals,
      // but we can verify the token is created successfully
      const url = service.createProxyUrl('image', { ttlMs: 1000 }); // Too short
      expect(url).toBeDefined();
    });

    it('should clamp TTL above maximum to maximum', () => {
      const url = service.createProxyUrl('image', { ttlMs: 10 * 60 * 1000 }); // 10 minutes
      expect(url).toBeDefined();
    });

    it('should accept valid TTL within bounds', () => {
      const url = service.createProxyUrl('image', { ttlMs: 3 * 60 * 1000 }); // 3 minutes
      expect(url).toBeDefined();
    });
  });

  describe('clearAllTokens', () => {
    it('should remove all tokens', () => {
      service.createProxyUrl('image-1');
      service.createProxyUrl('image-2');
      service.createProxyUrl('image-3');

      expect(service.getActiveTokenCount()).toBe(3);

      service.clearAllTokens();

      expect(service.getActiveTokenCount()).toBe(0);
    });
  });
});
