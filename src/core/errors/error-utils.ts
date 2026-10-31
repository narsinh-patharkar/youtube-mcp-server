/**
 * Error Utilities - Helper functions for error handling
 */

import { AppError, isAppError } from './domain-errors.js';
import type { ErrorCode } from './error-codes.js';
import { isRetryableError } from './error-codes.js';

/**
 * Result type for operations that can fail
 * Inspired by Rust's Result<T, E> / neverthrow
 */
export type Result<T, E = AppError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E extends AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(
  result: Result<T, E>
): result is { readonly ok: true; readonly value: T } {
  return result.ok === true;
}

export function isErr<T, E>(
  result: Result<T, E>
): result is { readonly ok: false; readonly error: E } {
  return result.ok === false;
}

/**
 * Try to execute a sync function and return Result
 */
export function trySync<T>(fn: () => T): Result<T, AppError> {
  try {
    return ok(fn());
  } catch (error) {
    return err(toAppError(error));
  }
}

/**
 * Try to execute an async function and return Result
 */
export async function tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, AppError>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(toAppError(error));
  }
}

/**
 * Convert any error to AppError
 */
export function toAppError(error: unknown, defaultCode: ErrorCode = 'INTERNAL_ERROR'): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Try to extract code from error message or cause
    const code = extractErrorCode(error) ?? defaultCode;
    return new AppError(code, error.message, { cause: error });
  }

  return new AppError(defaultCode, String(error));
}

/**
 * Extract error code from error message or known patterns
 */
function extractErrorCode(error: Error): ErrorCode | null {
  // Check for known error patterns in message
  const message = error.message.toLowerCase();

  const patterns: Array<{ pattern: RegExp; code: ErrorCode }> = [
    { pattern: /api key/i, code: 'LLM_API_KEY_INVALID' },
    { pattern: /rate limit/i, code: 'LLM_RATE_LIMITED' },
    { pattern: /quota exceed/i, code: 'LLM_QUOTA_EXCEEDED' },
    { pattern: /timeout/i, code: 'SUMMARIZATION_TIMEOUT' },
    { pattern: /not found/i, code: 'VIDEO_NOT_FOUND' },
    { pattern: /private/i, code: 'VIDEO_PRIVATE' },
    { pattern: /age restrict/i, code: 'VIDEO_AGE_RESTRICTED' },
    { pattern: /geo block/i, code: 'VIDEO_GEO_BLOCKED' },
    { pattern: /transcript.*disable/i, code: 'TRANSCRIPT_DISABLED' },
    { pattern: /transcript.*not.*found/i, code: 'TRANSCRIPT_NOT_FOUND' },
    { pattern: /language.*unavail/i, code: 'TRANSCRIPT_LANGUAGE_UNAVAILABLE' },
    { pattern: /connection.*refused/i, code: 'EXTERNAL_SERVICE_UNAVAILABLE' },
    { pattern: /econnrefused/i, code: 'EXTERNAL_SERVICE_UNAVAILABLE' },
    { pattern: /etimedout/i, code: 'EXTERNAL_SERVICE_TIMEOUT' },
    { pattern: /socket hang up/i, code: 'EXTERNAL_SERVICE_UNAVAILABLE' },
  ];

  for (const { pattern, code } of patterns) {
    if (pattern.test(message)) {
      return code;
    }
  }

  return null;
}

/**
 * Check if an error is retryable
 */
export function isErrorRetryable(error: unknown): boolean {
  if (isAppError(error)) {
    return error.isRetryable;
  }

  if (error instanceof Error) {
    const code = extractErrorCode(error);
    return code ? isRetryableError(code) : false;
  }

  return false;
}

/**
 * Get retry delay with exponential backoff
 */
export function getRetryDelay(
  attempt: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000
): number {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    retryableCodes?: ErrorCode[];
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    retryableCodes,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const shouldRetry =
        isErrorRetryable(lastError) &&
        (!retryableCodes ||
          retryableCodes.some((code) => {
            if (isAppError(lastError)) return lastError.code === code;
            return false;
          }));

      if (!shouldRetry || attempt === maxAttempts - 1) {
        throw lastError;
      }

      const delay = getRetryDelay(attempt, baseDelayMs, maxDelayMs);

      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Safe error message extraction
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

/**
 * Safe error stack extraction
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack;
  return undefined;
}

/**
 * Format error for logging
 */
export function formatErrorForLog(error: unknown): Record<string, unknown> {
  if (isAppError(error)) {
    return error.toJSON();
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}
