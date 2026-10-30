/**
 * Core Module - Public API
 */

export * from './errors/index.js';
export * from './logging/index.js';
export * from './di/index.js';
export * from './events/index.js';
// Re-export utils separately to avoid conflicts with errors
export {
  // Result types
  type Result,
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  trySync,
  tryAsync,
  // Async utilities
  sleep,
  withRetry,
  withTimeout,
  CircuitBreaker,
  CircuitState,
  Semaphore,
  withConcurrency,
  mapConcurrent,
  debounce,
  throttle,
  // Validation
  validate,
  validateOrThrow,
  ValidationError,
  createTransformSchema,
  CommonSchemas,
  validateEnv,
  coerce,
  // Crypto
  generateId,
  generateUuid,
  generateRandomString,
  generateToken,
  sha256,
  sha512,
  hmacSha256,
  constantTimeEqual,
  contentHash,
  cacheKey,
  verifyHmacSha256,
  checksum,
  generateApiKey,
  parseApiKey,
} from './utils/index.js';