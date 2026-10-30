/**
 * Async Utilities - Retry, timeout, circuit breaker, and concurrency control
 */

import type { AppError, ErrorCode } from '@core/errors/index.js';
import { isAppError, isErrorRetryable } from '@core/errors/index.js';

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry configuration
 */
export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
  retryableCodes?: ErrorCode[];
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    jitter = true,
    retryableCodes,
    onRetry,
    shouldRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const isRetryable = shouldRetry
        ? shouldRetry(lastError, attempt)
        : isErrorRetryable(lastError) &&
          (!retryableCodes || (isAppError(lastError) && retryableCodes.includes(lastError.code)));

      if (!isRetryable || attempt === maxAttempts - 1) {
        throw lastError;
      }

      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs, jitter);

      if (onRetry) {
        onRetry(lastError, attempt + 1, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError!;
}

function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number, jitter: boolean): number {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  if (jitter) {
    const jitterAmount = delay * 0.25;
    return Math.floor(delay + (Math.random() * 2 - 1) * jitterAmount);
  }
  return delay;
}

/**
 * Timeout wrapper for promises
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError?: Error
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(timeoutError ?? new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Circuit Breaker States
 */
export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing, reject immediately
  HALF_OPEN = 'half_open', // Testing if service recovered
}

/**
 * Circuit Breaker Configuration
 */
export interface CircuitBreakerOptions {
  failureThreshold?: number;    // Failures before opening (default: 5)
  successThreshold?: number;    // Successes before closing (default: 2)
  timeoutMs?: number;           // Time before half-open (default: 30000)
  monitoringPeriodMs?: number;  // Rolling window for failures (default: 60000)
  onStateChange?: (state: CircuitState) => void;
}

/**
 * Circuit Breaker for external service calls
 */
export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      successThreshold: options.successThreshold ?? 2,
      timeoutMs: options.timeoutMs ?? 30000,
      monitoringPeriodMs: options.monitoringPeriodMs ?? 60000,
      onStateChange: options.onStateChange ?? (() => {}),
    };
  }

  getState(): CircuitState {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure >= this.options.timeoutMs) {
        this.transitionTo(CircuitState.HALF_OPEN);
      }
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.getState();

    if (state === CircuitState.OPEN) {
      throw new Error('Circuit breaker is OPEN');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.options.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.successes = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED && this.failures >= this.options.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.successes = 0;
      this.options.onStateChange(newState);
    }
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
  }
}

/**
 * Semaphore for concurrency control
 */
export class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise(resolve => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    const next = this.waitQueue.shift();
    if (next) {
      this.permits--;
      next();
    }
  }

  async withPermit<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  get availablePermits(): number {
    return this.permits;
  }

  get waitingCount(): number {
    return this.waitQueue.length;
  }
}

/**
 * Execute multiple async functions with controlled concurrency
 */
export async function withConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number
): Promise<void> {
  const semaphore = new Semaphore(concurrency);
  const errors: Error[] = [];

  await Promise.all(items.map(async item => {
    await semaphore.withPermit(async () => {
      try {
        await fn(item);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }));

  if (errors.length > 0) {
    throw new Error(`${errors.length} operations failed: ${errors.map(e => e.message).join('; ')}`);
  }
}

/**
 * Map with concurrency control
 */
export async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const semaphore = new Semaphore(concurrency);
  const results: R[] = [];

  await Promise.all(items.map(async item => {
    const result = await semaphore.withPermit(() => fn(item));
    results.push(result);
  }));

  return results;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  intervalMs: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = intervalMs - (now - lastCall);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, remaining);
    }
  };
}