/**
 * Cache Mocks - Mock implementations for testing
 */

import type { CachePort } from '@infrastructure/cache/sqlite.repository.js';
import { vi } from 'vitest';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Create a mock cache repository
 */
export function createMockCacheRepository<T = unknown>() {
  const store = new Map<string, CacheEntry<T>>();

  return {
    get: vi.fn().mockImplementation(async (key: string): Promise<T | null> => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),

    set: vi.fn().mockImplementation(async (key: string, value: T, ttlSeconds: number): Promise<void> => {
      store.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }),

    delete: vi.fn().mockImplementation(async (key: string): Promise<boolean> => {
      return store.delete(key);
    }),

    clear: vi.fn().mockImplementation(async (): Promise<void> => {
      store.clear();
    }),

    size: vi.fn().mockImplementation(() => store.size),

    keys: vi.fn().mockImplementation(() => Array.from(store.keys())),

    // Test helpers
    _store: store,
    _reset: () => store.clear(),
  };
}

/**
 * Create a mock cache with pre-populated data
 */
export function createPrepopulatedCacheRepository<T = unknown>(
  initialData: Record<string, T>,
  ttlSeconds: number = 3600
) {
  const mock = createMockCacheRepository<T>();

  // Pre-populate
  for (const [key, value] of Object.entries(initialData)) {
    store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  return mock;
}

// Need access to store from createMockCacheRepository
let store: Map<string, CacheEntry<unknown>> = new Map();

// Re-create with shared store
function createSharedMockCacheRepository<T = unknown>() {
  return {
    get: vi.fn().mockImplementation(async (key: string): Promise<T | null> => {
      const entry = store.get(key) as CacheEntry<T> | undefined;
      if (!entry) return null;
      if (entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),

    set: vi.fn().mockImplementation(async (key: string, value: T, ttlSeconds: number): Promise<void> => {
      store.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }),

    delete: vi.fn().mockImplementation(async (key: string): Promise<boolean> => {
      return store.delete(key);
    }),

    clear: vi.fn().mockImplementation(async (): Promise<void> => {
      store.clear();
    }),

    size: vi.fn().mockImplementation(() => store.size),

    keys: vi.fn().mockImplementation(() => Array.from(store.keys())),

    _store: store,
    _reset: () => store.clear(),
  };
}

/**
 * Create a mock that simulates cache failures
 */
export function createFailingCacheRepository<T = unknown>(
  failOn: 'get' | 'set' | 'delete' | 'all' = 'all',
  error: Error = new Error('Cache unavailable')
) {
  const mock = createSharedMockCacheRepository<T>();

  if (failOn === 'get' || failOn === 'all') {
    mock.get.mockRejectedValue(error);
  }
  if (failOn === 'set' || failOn === 'all') {
    mock.set.mockRejectedValue(error);
  }
  if (failOn === 'delete' || failOn === 'all') {
    mock.delete.mockRejectedValue(error);
  }

  return mock;
}

/**
 * Create a mock with TTL enforcement
 */
export function createTTLEnforcingCacheRepository<T = unknown>() {
  const mock = createSharedMockCacheRepository<T>();

  // Override get to enforce TTL
  mock.get.mockImplementation(async (key: string): Promise<T | null> => {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      store.delete(key);
      return null;
    }
    return entry.value;
  });

  return mock;
}

/**
 * Create a mock that tracks hit/miss statistics
 */
export function createInstrumentedCacheRepository<T = unknown>() {
  const stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  const mock = createSharedMockCacheRepository<T>();

  mock.get.mockImplementation(async (key: string): Promise<T | null> => {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry || entry.expiresAt < Date.now()) {
      stats.misses++;
      if (entry) store.delete(key);
      return null;
    }
    stats.hits++;
    return entry.value;
  });

  mock.set.mockImplementation(async (key: string, value: T, ttlSeconds: number): Promise<void> => {
    store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    stats.sets++;
  });

  mock.delete.mockImplementation(async (key: string): Promise<boolean> => {
    const result = store.delete(key);
    if (result) stats.deletes++;
    return result;
  });

  return {
    ...mock,
    getStats: vi.fn().mockImplementation(() => ({ ...stats })),
    resetStats: vi.fn().mockImplementation(() => {
      stats.hits = 0;
      stats.misses = 0;
      stats.sets = 0;
      stats.deletes = 0;
    }),
  };
}