/**
 * Core Errors Tests
 */

import { describe, it, expect } from 'vitest';
import { AppError, isAppError, ValidationError } from '@core/errors/index.js';
import { ok, err, isOk, isErr, unwrap, unwrapOr, unwrapOrElse, trySync } from '@core/utils/result.js';
import { z } from 'zod';
import { validate, validateOrThrow, ValidationError, CommonSchemas } from '@core/utils/validation.js';

describe('AppError', () => {
  it('should create an error with all properties', () => {
    const error = new AppError('INTERNAL_ERROR', 'Test error', {
      statusCode: 500,
      context: { key: 'value' },
      cause: new Error('cause'),
    });

    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500);
    expect(error.context).toEqual({ key: 'value' });
    expect(error.cause).toBeInstanceOf(Error);
    expect(error.errorId).toBeDefined();
    expect(error.timestamp).toBeInstanceOf(Date);
  });

  it('should serialize to JSON correctly', () => {
    const error = new AppError('VIDEO_NOT_FOUND', 'Video not found');
    const json = error.toJSON();

    expect(json.code).toBe('VIDEO_NOT_FOUND');
    expect(json.message).toBe('Video not found');
    expect(json.errorId).toBeDefined();
    expect(json.timestamp).toBeDefined();
  });

  it('should add context with withContext (creates new error with new errorId)', () => {
    const error = new AppError('INTERNAL_ERROR', 'Test');
    const newError = error.withContext({ additional: 'context' });

    expect(newError.context).toEqual({ additional: 'context' });
    // withContext creates a new error with new errorId (by design)
    expect(newError.errorId).not.toBe(error.errorId);
    expect(newError.stack).toBe(error.stack);
  });
});

describe('isAppError', () => {
  it('should return true for AppError instances', () => {
    const error = new AppError('INTERNAL_ERROR', 'Test');
    expect(isAppError(error)).toBe(true);
  });

  it('should return false for regular Errors', () => {
    const error = new Error('Test');
    expect(isAppError(error)).toBe(false);
  });

  it('should return false for other values', () => {
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
    expect(isAppError('string')).toBe(false);
    expect(isAppError({})).toBe(false);
  });
});

describe('Result type', () => {
  it('should create Ok result', () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    expect(result.value).toBe(42);
  });

  it('should create Err result', () => {
    const error = new AppError('INTERNAL_ERROR', 'Test');
    const result = err(error);
    expect(isOk(result)).toBe(false);
    expect(isErr(result)).toBe(true);
    expect(result.error).toBe(error);
  });

  it('should unwrap Ok value', () => {
    const result = ok(42);
    expect(unwrap(result)).toBe(42);
  });

  it('should throw on unwrap Err', () => {
    const result = err(new AppError('INTERNAL_ERROR', 'Test'));
    expect(() => unwrap(result)).toThrow();
  });

  it('should return default on unwrapOr for Err', () => {
    const result = err(new AppError('INTERNAL_ERROR', 'Test'));
    expect(unwrapOr(result, 100)).toBe(100);
  });

  it('should return value on unwrapOr for Ok', () => {
    const result = ok(42);
    expect(unwrapOr(result, 100)).toBe(42);
  });

  it('should trySync successfully', () => {
    const result = trySync(() => 42);
    expect(isOk(result)).toBe(true);
    expect(result.value).toBe(42);
  });

  it('should trySync catch errors and wrap in AppError', () => {
    const result = trySync(() => { throw new Error('Test'); });
    expect(isErr(result)).toBe(true);
    // trySync wraps the error in AppError with INTERNAL_ERROR code
    expect(result.error).toBeInstanceOf(AppError);
    expect(result.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('Validation', () => {
  it('should validate valid data', () => {
    const result = validate(CommonSchemas.nonEmptyString, 'hello');
    expect(isOk(result)).toBe(true);
    expect(result.value).toBe('hello');
  });

  it('should fail validation for invalid data', () => {
    const result = validate(CommonSchemas.nonEmptyString, '');
    expect(isErr(result)).toBe(true);
    expect(result.error).toBeInstanceOf(ValidationError);
  });

  it('should throw on validateOrThrow for invalid data', () => {
    expect(() => validateOrThrow(CommonSchemas.nonEmptyString, '')).toThrow(ValidationError);
  });

  it('should return value on validateOrThrow for valid data', () => {
    expect(validateOrThrow(CommonSchemas.nonEmptyString, 'hello')).toBe('hello');
  });

  it('should validate URL', () => {
    const result = validate(CommonSchemas.url, 'https://example.com');
    expect(isOk(result)).toBe(true);
  });

  it('should validate positive int', () => {
    const result = validate(CommonSchemas.positiveInt, 42);
    expect(isOk(result)).toBe(true);
  });

  it('should fail positive int for negative', () => {
    const result = validate(CommonSchemas.positiveInt, -1);
    expect(isErr(result)).toBe(true);
  });
});

describe('ZodError in ValidationError', () => {
  it('should include issues in ValidationError', () => {
    try {
      validateOrThrow(z.string().email(), 'not-an-email');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).issues).toBeDefined();
      expect((error as ValidationError).issues.length).toBeGreaterThan(0);
    }
  });
});