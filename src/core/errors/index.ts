/**
 * Errors Module - Public API
 */

export {
  ErrorCategories,
  ErrorCodes,
  getErrorCategory,
  isClientError,
  isFatalError,
  isRetryableError,
  isServerError,
} from './error-codes.js';
export type { ErrorCode } from './error-codes.js';

export {
  AppError,
  CacheError,
  ConfigError,
  ExternalServiceError,
  HTTPError,
  InternalError,
  LLMError,
  MCPError,
  RateLimitError,
  SummarizationError,
  TranscriptError,
  VideoError,
  isAppError,
  isCacheError,
  isConfigError,
  isExternalServiceError,
  isHTTPError,
  isInternalError,
  isLLMError,
  isMCPError,
  isRateLimitError,
  isSummarizationError,
  isTranscriptError,
  isVideoError,
} from './domain-errors.js';

export {
  InvalidToolArgumentsError,
  ProtocolError,
  ToolExecutionError,
  ToolNotFoundError,
  TransportError,
  toMCPErrorResponse,
  type MCPErrorResponse,
} from './mcp-errors.js';

export {
  err,
  formatErrorForLog,
  getErrorMessage,
  getErrorStack,
  getRetryDelay,
  isErr,
  isErrorRetryable,
  isOk,
  ok,
  toAppError,
  tryAsync,
  trySync,
  withRetry,
} from './error-utils.js';
export type { Result } from './error-utils.js';
