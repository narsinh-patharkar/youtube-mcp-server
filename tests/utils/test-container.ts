/**
 * Test Container - DI container for testing with easy mocking
 */

import { TypedContainer, diContainer, provideFactory, provideValue } from '@core/di/container.js';
import type { TokenMap } from '@core/di/tokens.js';
import type { AppLogger } from '@core/logging/logger.js';
import { createMockConfig, createMockLogger } from '../setup.js';

/**
 * Create a test container with common mocks pre-registered
 */
export function createTestContainer(overrides: Partial<TokenMap> = {}): TypedContainer {
  const container = new TypedContainer();

  // Register default mocks
  const mockLogger = createMockLogger();
  const mockConfig = createMockConfig();

  provideValue(container, 'config' as any, mockConfig);
  provideValue(container, 'logger' as any, mockLogger);
  provideValue(container, 'transcriptConfig' as any, mockConfig.transcript);
  provideValue(container, 'summarizationConfig' as any, mockConfig.summarization);
  provideValue(container, 'cacheConfig' as any, mockConfig.cache);
  provideValue(container, 'rateLimitConfig' as any, mockConfig.rateLimit);
  provideValue(container, 'httpConfig' as any, mockConfig.http);
  provideValue(container, 'loggingConfig' as any, mockConfig.logging);

  // Apply overrides
  for (const [token, value] of Object.entries(overrides)) {
    provideValue(container, token as any, value);
  }

  return container;
}

/**
 * Create a test container with real implementations (for integration tests)
 */
export async function createIntegrationContainer(
  configOverrides: Partial<TokenMap> = {}
): Promise<TypedContainer> {
  const container = createTestContainer(configOverrides);

  // Register real implementations here when they exist
  // provideValue(container, 'transcriptRepository' as any, new SqliteRepository(...));

  return container;
}

/**
 * Mock factory for creating typed mocks
 */
export function mockFactory<T>(implementation: Partial<T> = {}): T {
  return {
    ...implementation,
  } as T;
}

/**
 * Create a mock that tracks calls
 */
export function createSpy<T extends (...args: unknown[]) => unknown>(
  fn: T
): T & { calls: Parameters<T>[] } {
  const calls: Parameters<T>[] = [];
  const spy = ((...args: Parameters<T>) => {
    calls.push(args);
    return fn(...args);
  }) as T & { calls: Parameters<T>[] };
  spy.calls = calls;
  return spy;
}

/**
 * Assert spy was called with specific arguments
 */
export function expectSpyCall<T extends (...args: unknown[]) => unknown>(
  spy: T & { calls: Parameters<T>[] },
  expectedArgs: Parameters<T>
): void {
  const found = spy.calls.some(
    (call) => call.length === expectedArgs.length && call.every((arg, i) => arg === expectedArgs[i])
  );

  if (!found) {
    throw new Error(
      `Spy was not called with expected arguments.\nExpected: ${JSON.stringify(expectedArgs)}\nActual calls: ${JSON.stringify(spy.calls)}`
    );
  }
}
