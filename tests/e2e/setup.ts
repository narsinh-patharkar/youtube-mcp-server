/**
 * E2E Test Setup - Integration test configuration
 */

import { resetContainer } from '@core/di/container.js';
import { resetLifecycleManager } from '@core/di/lifecycle.js';
import { resetEventEmitter } from '@core/events/emitter.js';
import { setLogger } from '@core/logging/logger.js';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

// Load test environment
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

beforeAll(async () => {
  // Verify required environment variables for integration tests
  const required = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`Missing API keys for integration tests: ${missing.join(', ')}`);
    console.warn('Some tests will be skipped');
  }
});

afterAll(async () => {
  // Cleanup
});

beforeEach(() => {
  resetContainer();
  resetLifecycleManager();
  resetEventEmitter();
  setLogger({
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
    child: () => setLogger,
    flush: async () => {},
  });
});

afterEach(() => {
  // Cleanup
});
