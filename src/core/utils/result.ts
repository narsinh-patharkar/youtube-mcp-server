/**
 * Result Type - Functional error handling inspired by Rust's Result<T, E>
 * Provides type-safe error handling without exceptions
 */

import type { AppError } from '@core/errors/index.js';
import { toAppError } from '@core/errors/error-utils.js';

/**
 * Result type representing either success (Ok) or failure (Err)
 */
export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * Create a successful Result
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Create a failed Result
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Type guards
 */
export function isOk<T, E>(result: Result<T, E>): result is { readonly ok: true; readonly value: T } {
  return result.ok === true;
}

export function isErr<T, E>(result: Result<T, E>): result is { readonly ok: false; readonly error: E } {
  return result.ok === false;
}

/**
 * Map over the success value
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Map over the error value
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * FlatMap (bind) - chain operations that return Results
 */
export function flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
}

/**
 * Unwrap the value or throw
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwrap the value or return a default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Unwrap the value or compute a default
 */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
  if (isOk(result)) {
    return result.value;
  }
  return fn(result.error);
}

/**
 * Convert Result to Promise
 */
export function toPromise<T, E>(result: Result<T, E>): Promise<T> {
  if (isOk(result)) {
    return Promise.resolve(result.value);
  }
  return Promise.reject(result.error);
}

/**
 * Execute a synchronous function and return Result
 */
export function trySync<T>(fn: () => T): Result<T, AppError> {
  try {
    return ok(fn());
  } catch (error) {
    return err(toAppError(error));
  }
}

/**
 * Execute an asynchronous function and return Result
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
 * Combine multiple Results into one (all must succeed)
 */
export function combine<T extends readonly Result<unknown, unknown>[]>(
  results: T
): Result<{ [K in keyof T]: T[K] extends Result<infer U, unknown> ? U : never }, T[number] extends Result<unknown, infer E> ? E : never> {
  for (const result of results) {
    if (isErr(result)) {
      return result as Result<never, T[number] extends Result<unknown, infer E> ? E : never>;
    }
  }

  return ok(results.map(r => (r as { ok: true; value: unknown }).value) as { [K in keyof T]: T[K] extends Result<infer U, unknown> ? U : never });
}

/**
 * Get first successful Result
 */
export function firstOk<T, E>(results: Result<T, E>[]): Result<T, E> {
  for (const result of results) {
    if (isOk(result)) {
      return result;
    }
  }
  // All results are Err, so we can safely access .error
  const lastResult = results[results.length - 1];
  if (lastResult && !isOk(lastResult)) {
    return err(lastResult.error);
  }
  return err(new Error('No results provided') as E);
}

/**
 * Partition Results into successes and failures
 */
export function partition<T, E>(results: Result<T, E>[]): { ok: T[]; err: E[] } {
  const ok: T[] = [];
  const err: E[] = [];

  for (const result of results) {
    if (isOk(result)) {
      ok.push(result.value);
    } else {
      err.push(result.error);
    }
  }

  return { ok, err };
}