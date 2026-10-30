/**
 * Validation Utilities - Zod helpers for runtime validation
 */

import { z, type ZodSchema, ZodError } from 'zod';
import type { Result } from './result.js';
import { ok, err, isOk, isErr, unwrap, unwrapOr, unwrapOrElse } from './result.js';

/**
 * Validate data against a schema, returning Result
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): Result<T, ValidationError> {
  const result = schema.safeParse(data);
  if (result.success) {
    return ok(result.data);
  }
  return err(new ValidationError(result.error));
}

/**
 * Validate data against a schema, throwing on failure
 */
export function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = validate(schema, data);
  if (!isOk(result)) {
    throw result.error;
  }
  return result.value;
}

/**
 * Validation Error with detailed issues
 */
export class ValidationError extends Error {
  public readonly issues: z.ZodIssue[];

  constructor(zodError: ZodError) {
    super(`Validation failed: ${zodError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
    this.name = 'ValidationError';
    this.issues = zodError.errors;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      issues: this.issues.map(issue => ({
        path: issue.path,
        message: issue.message,
        code: issue.code,
      })),
    };
  }
}

/**
 * Create a schema that transforms and validates
 */
export function createTransformSchema<TInput, TOutput>(
  inputSchema: ZodSchema<TInput>,
  transform: (input: TInput) => TOutput,
  outputSchema?: ZodSchema<TOutput>
): ZodSchema<TOutput> {
  const piped = inputSchema.transform(transform).pipe(outputSchema ?? z.any());
  return piped as unknown as ZodSchema<TOutput>;
}

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  // Non-empty string
  nonEmptyString: z.string().min(1),

  // URL
  url: z.string().url(),

  // Positive integer
  positiveInt: z.number().int().positive(),

  // Non-negative integer
  nonNegativeInt: z.number().int().nonnegative(),

  // Port number
  port: z.number().int().min(1).max(65535),

  // ISO date string
  isoDate: z.string().datetime(),

  // UUID
  uuid: z.string().uuid(),

  // Email
  email: z.string().email(),

  // Semver
  semver: z.string().regex(/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/),

  // Environment
  environment: z.enum(['development', 'test', 'staging', 'production']),
} as const;

/**
 * Validate environment variables
 */
export function validateEnv<T extends Record<string, ZodSchema<unknown>>>(
  schemas: T,
  env: Record<string, string | undefined> = process.env
): { [K in keyof T]: z.infer<T[K]> } {
  const result: Record<string, unknown> = {};

  for (const [key, schema] of Object.entries(schemas)) {
    const value = env[key];
    const validation = schema.safeParse(value);
    if (!validation.success) {
      throw new ValidationError(new ZodError([...validation.error.errors].map(e => ({
        ...e,
        path: [key, ...e.path],
      }))));
    }
    result[key] = validation.data;
  }

  return result as { [K in keyof T]: z.infer<T[K]> };
}

/**
 * Coerce string to type
 */
export const coerce = {
  number: z.coerce.number(),
  boolean: z.coerce.boolean(),
  date: z.coerce.date(),
  array: <T>(elementSchema: ZodSchema<T>) => z.preprocess(
    (val) => (typeof val === 'string' ? val.split(',').map(v => v.trim()) : val),
    z.array(elementSchema)
  ),
};

// Re-export Result for convenience
export type { Result } from './result.js';
export { ok, err, isOk, isErr, unwrap, unwrapOr, unwrapOrElse } from './result.js';