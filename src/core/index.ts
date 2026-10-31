/**
 * Core Module - Public API
 */

export * from './di/index.js';
export * from './errors/index.js';
export * from './events/index.js';
export * from './logging/index.js';
// Re-export utils separately to avoid conflicts with errors
export {
  CircuitBreaker,
  CircuitState,
  CommonSchemas,
  Semaphore,
  ValidationError,
  cacheKey,
  checksum,
  coerce,
  constantTimeEqual,
  contentHash,
  createTransformSchema,
  debounce,
  err,
  generateApiKey,
  // Crypto
  generateId,
  generateRandomString,
  generateToken,
  generateUuid,
  hmacSha256,
  isErr,
  isOk,
  mapConcurrent,
  ok,
  parseApiKey,
  sha256,
  sha512,
  // Async utilities
  sleep,
  throttle,
  tryAsync,
  trySync,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  // Validation
  validate,
  validateEnv,
  validateOrThrow,
  verifyHmacSha256,
  withConcurrency,
  withRetry,
  withTimeout,
  // Result types
  type Result,
} from './utils/index.js';
