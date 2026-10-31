/**
 * Test Setup - Global test configuration and utilities
 */

import { resetContainer } from '@core/di/container.js';
import { resetLifecycleManager } from '@core/di/lifecycle.js';
import { resetEventEmitter } from '@core/events/emitter.js';
import { setLogger } from '@core/logging/logger.js';
import 'reflect-metadata';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console.log in tests unless DEBUG_TESTS is set
  if (!process.env.DEBUG_TESTS) {
    console.log = vi.fn();
    console.debug = vi.fn();
    console.info = vi.fn();
  }
  console.warn = vi.fn();
  console.error = vi.fn();
});

afterAll(() => {
  // Restore console
  Object.assign(console, originalConsole);
});

beforeEach(() => {
  // Reset DI container
  resetContainer();

  // Reset lifecycle manager
  resetLifecycleManager();

  // Reset event emitter
  resetEventEmitter();

  // Reset logger
  setLogger({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    flush: vi.fn().mockResolvedValue(undefined),
  });

  // Clear all mocks
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetModules();
});

// Global test utilities
export function createMockLogger() {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    flush: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockConfig(overrides: Record<string, unknown> = {}) {
  return {
    name: 'youtube-mcp-server',
    version: '0.1.0',
    environment: 'test' as const,
    transport: 'stdio' as const,
    transcript: {
      preferredSource: 'youtube-transcript-api' as const,
      fallbackToYtDlp: true,
      ytDlpPath: undefined,
      defaultLanguage: 'en',
      timeoutMs: 30000,
      maxRetries: 2,
      userAgent: 'Mozilla/5.0 (compatible; YouTubeMCP/1.0)',
    },
    summarization: {
      provider: 'claude' as const,
      claude: {
        apiKey: 'test-key',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 8192,
        temperature: 0.3,
        baseUrl: undefined,
        timeoutMs: 120000,
      },
      openai: undefined,
      ollama: undefined,
      defaultStyle: 'detailed' as const,
      maxTranscriptTokens: 100000,
      chunkSizeTokens: 8000,
      chunkOverlapTokens: 500,
      enableChunking: true,
      systemPrompt: undefined,
    },
    cache: {
      enabled: true,
      type: 'memory' as const,
      sqlitePath: './data/cache.db',
      redisUrl: undefined,
      redisKeyPrefix: 'yt-mcp:',
      ttlSeconds: 604800,
      maxEntries: 10000,
      cleanupIntervalMs: 3600000,
      vacuumOnStartup: false,
    },
    rateLimit: {
      enabled: false,
      requestsPerMinute: 30,
      requestsPerHour: 200,
      requestsPerDay: 1000,
      burstAllowance: 5,
      keyPrefix: 'ratelimit:',
    },
    http: {
      enabled: false,
      host: '0.0.0.0',
      port: 3000,
      cors: { enabled: true, origin: '*', credentials: false },
      auth: { enabled: false, apiKeys: [], headerName: 'x-api-key' },
      requestTimeoutMs: 30000,
      bodyLimit: '1mb',
    },
    youtubeDataApi: {
      enabled: false,
      apiKey: undefined,
      quotaPerDay: 10000,
      timeoutMs: 10000,
    },
    logging: {
      level: 'error' as const,
      prettyPrint: false,
      redactPaths: ['*.apiKey', '*.authorization', '*.cookie'],
      serializers: {},
      dest: 'stdout' as const,
    },
    gracefulShutdownTimeoutMs: 10000,
    healthCheckIntervalMs: 30000,
    ...overrides,
  };
}

// Custom matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeOk(): T;
    toBeErr(): T;
  }
}

// Extend Vitest matchers
import { expect } from 'vitest';

expect.extend({
  toBeOk(received: { ok: boolean; value: unknown }) {
    if (received.ok) {
      return { pass: true, message: () => 'Expected Result to be Err' };
    }
    return { pass: false, message: () => 'Expected Result to be Ok' };
  },

  toBeErr(received: { ok: boolean; error: unknown }) {
    if (!received.ok) {
      return { pass: true, message: () => 'Expected Result to be Ok' };
    }
    return { pass: false, message: () => 'Expected Result to be Err' };
  },
});

// Type augmentation for custom matchers
interface CustomMatchers<R = unknown> {
  toBeOk(): R;
  toBeErr(): R;
}

declare global {
  namespace Vi {
    interface Assertion extends CustomMatchers {}
    interface AsymmetricMatchersContaining extends CustomMatchers {}
  }
}
