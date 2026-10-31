/**
 * Child Logger Factory - Create contextual loggers
 */

import type { AppLogger } from './logger.js';

/**
 * Standard context keys for consistent logging
 */
export const LogContext = {
  // Request/operation context
  requestId: 'requestId',
  correlationId: 'correlationId',
  traceId: 'traceId',
  spanId: 'spanId',

  // User/client context
  userId: 'userId',
  clientId: 'clientId',
  sessionId: 'sessionId',

  // Domain context
  videoId: 'videoId',
  videoUrl: 'videoUrl',
  toolName: 'toolName',
  provider: 'provider',
  model: 'model',

  // Performance context
  durationMs: 'durationMs',
  cacheHit: 'cacheHit',
  retryAttempt: 'retryAttempt',

  // Error context
  errorCode: 'errorCode',
  errorId: 'errorId',
} as const;

/**
 * Create a child logger with standard bindings
 */
export function createChildLogger(parent: AppLogger, bindings: Record<string, unknown>): AppLogger {
  return parent.child(bindings);
}

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(
  parent: AppLogger,
  requestId: string,
  additional?: Record<string, unknown>
): AppLogger {
  return parent.child({
    [LogContext.requestId]: requestId,
    ...additional,
  });
}

/**
 * Create a tool-scoped logger
 */
export function createToolLogger(
  parent: AppLogger,
  toolName: string,
  additional?: Record<string, unknown>
): AppLogger {
  return parent.child({
    [LogContext.toolName]: toolName,
    ...additional,
  });
}

/**
 * Create a video-scoped logger
 */
export function createVideoLogger(
  parent: AppLogger,
  videoId: string,
  additional?: Record<string, unknown>
): AppLogger {
  return parent.child({
    [LogContext.videoId]: videoId,
    ...additional,
  });
}

/**
 * Create an LLM provider logger
 */
export function createProviderLogger(
  parent: AppLogger,
  provider: string,
  model?: string,
  additional?: Record<string, unknown>
): AppLogger {
  return parent.child({
    [LogContext.provider]: provider,
    [LogContext.model]: model,
    ...additional,
  });
}

/**
 * Timing utility - log duration of async operation
 */
export async function withTiming<T>(
  logger: AppLogger,
  operation: string,
  fn: () => Promise<T>,
  additionalMeta?: Record<string, unknown>
): Promise<T> {
  const start = process.hrtime.bigint();
  try {
    const result = await fn();
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.debug(`${operation} completed`, {
      ...additionalMeta,
      [LogContext.durationMs]: Math.round(durationMs),
    });
    return result;
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.error(`${operation} failed`, {
      ...additionalMeta,
      [LogContext.durationMs]: Math.round(durationMs),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Log level helpers for conditional logging
 */
export const LogLevel = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  FATAL: 60,
} as const;

export function shouldLog(logger: AppLogger, level: number): boolean {
  // Pino doesn't expose level directly, but we can check via child bindings
  // This is a best-effort helper
  return true;
}
