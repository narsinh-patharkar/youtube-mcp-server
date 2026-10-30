/**
 * Domain Errors - Base error classes with structured metadata
 * All application errors should extend AppError
 */

import type { ErrorCode } from './error-codes.js';
import { getErrorCategory } from './error-codes.js';

/**
 * Base application error with rich metadata
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isRetryable: boolean;
  public readonly isClientError: boolean;
  public readonly context: Record<string, unknown>;
  public readonly cause?: Error;
  public readonly timestamp: Date;
  public readonly errorId: string;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      statusCode?: number;
      context?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = options.statusCode ?? this.defaultStatusCode(code);
    this.isRetryable = getErrorCategory(code) === 'retryable';
    this.isClientError = getErrorCategory(code) === 'client';
    this.context = options.context ?? {};
    this.cause = options.cause;
    this.timestamp = new Date();
    this.errorId = crypto.randomUUID();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  private defaultStatusCode(code: ErrorCode): number {
    const category = getErrorCategory(code);
    switch (category) {
      case 'client': return 400;
      case 'retryable': return 503;
      case 'server': return 500;
      case 'fatal': return 500;
      default: return 500;
    }
  }

  /**
   * Serialize error for logging/transport
   */
  toJSON(): Record<string, unknown> {
    return {
      errorId: this.errorId,
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      isRetryable: this.isRetryable,
      isClientError: this.isClientError,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack,
      } : undefined,
    };
  }

  /**
   * Create a new error with additional context
   */
  withContext(context: Record<string, unknown>): AppError {
    const newError = new AppError(this.code, this.message, {
      statusCode: this.statusCode,
      context: { ...this.context, ...context },
      cause: this.cause,
    });
    newError.stack = this.stack;
    return newError;
  }
}

// ============================================================================
// Specific Error Classes
// ============================================================================

export class ConfigError extends AppError {
  constructor(code: ErrorCode, message: string, options?: { context?: Record<string, unknown>; cause?: Error }) {
    super(code, message, options);
  }
}

export class VideoError extends AppError {
  constructor(code: ErrorCode, message: string, options?: { context?: Record<string, unknown>; cause?: Error }) {
    super(code, message, options);
  }
}

export class TranscriptError extends AppError {
  constructor(code: ErrorCode, message: string, options?: { context?: Record<string, unknown>; cause?: Error }) {
    super(code, message, options);
  }
}

export class SummarizationError extends AppError {
  constructor(code: ErrorCode, message: string, options?: { context?: Record<string, unknown>; cause?: Error }) {
    super(code, message, options);
  }
}

export class LLMError extends AppError {
  public readonly provider: string;
  public readonly model?: string;

  constructor(
    code: ErrorCode,
    message: string,
    provider: string,
    options?: { context?: Record<string, unknown>; cause?: Error; model?: string }
  ) {
    super(code, message, {
      ...options,
      context: { ...options?.context, provider, model: options?.model },
    });
    this.provider = provider;
    this.model = options?.model;
  }
}

export class CacheError extends AppError {
  constructor(code: ErrorCode, message: string, options?: { context?: Record<string, unknown>; cause?: Error }) {
    super(code, message, options);
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfterMs?: number;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { context?: Record<string, unknown>; cause?: Error; retryAfterMs?: number }
  ) {
    super(code, message, options);
    this.retryAfterMs = options?.retryAfterMs;
  }
}

export class MCPError extends AppError {
  public readonly toolName?: string;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { context?: Record<string, unknown>; cause?: Error; toolName?: string }
  ) {
    super(code, message, options);
    this.toolName = options?.toolName;
  }
}

export class HTTPError extends AppError {
  public readonly method?: string;
  public readonly url?: string;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { context?: Record<string, unknown>; cause?: Error; method?: string; url?: string }
  ) {
    super(code, message, options);
    this.method = options?.method;
    this.url = options?.url;
  }
}

export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(
    code: ErrorCode,
    message: string,
    service: string,
    options?: { context?: Record<string, unknown>; cause?: Error }
  ) {
    super(code, message, {
      ...options,
      context: { ...options?.context, service },
    });
    this.service = service;
  }
}

export class InternalError extends AppError {
  constructor(message: string, options?: { context?: Record<string, unknown>; cause?: Error }) {
    super('INTERNAL_ERROR', message, options);
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard for specific error types
 */
export function isConfigError(error: unknown): error is ConfigError {
  return error instanceof ConfigError;
}

export function isVideoError(error: unknown): error is VideoError {
  return error instanceof VideoError;
}

export function isTranscriptError(error: unknown): error is TranscriptError {
  return error instanceof TranscriptError;
}

export function isSummarizationError(error: unknown): error is SummarizationError {
  return error instanceof SummarizationError;
}

export function isLLMError(error: unknown): error is LLMError {
  return error instanceof LLMError;
}

export function isCacheError(error: unknown): error is CacheError {
  return error instanceof CacheError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function isMCPError(error: unknown): error is MCPError {
  return error instanceof MCPError;
}

export function isHTTPError(error: unknown): error is HTTPError {
  return error instanceof HTTPError;
}

export function isExternalServiceError(error: unknown): error is ExternalServiceError {
  return error instanceof ExternalServiceError;
}

export function isInternalError(error: unknown): error is InternalError {
  return error instanceof InternalError;
}