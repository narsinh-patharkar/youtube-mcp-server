/**
 * Errors Module - Public API
 */

export type { ErrorCode } from './error-codes.js';
export { ErrorCodes, ErrorCategories, isClientError, isRetryableError, isServerError, isFatalError, getErrorCategory } from './error-codes.js';

export { AppError, ConfigError, VideoError, TranscriptError, SummarizationError, LLMError, CacheError, RateLimitError, MCPError, HTTPError, ExternalServiceError, InternalError } from './domain-errors.js';
export { isAppError, isConfigError, isVideoError, isTranscriptError, isSummarizationError, isLLMError, isCacheError, isRateLimitError, isMCPError, isHTTPError, isExternalServiceError, isInternalError } from './domain-errors.js';

export { ToolExecutionError, InvalidToolArgumentsError, ToolNotFoundError, TransportError, ProtocolError, type MCPErrorResponse, toMCPErrorResponse } from './mcp-errors.js';

export type { Result } from './error-utils.js';
export { ok, err, isOk, isErr, trySync, tryAsync, toAppError, isErrorRetryable, getRetryDelay, withRetry, getErrorMessage, getErrorStack, formatErrorForLog } from './error-utils.js';