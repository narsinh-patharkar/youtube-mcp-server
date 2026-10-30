/**
 * MCP Protocol Errors - Errors specific to MCP tool execution
 * These map to MCP error responses
 */

import type { ErrorCode } from './error-codes.js';
import { MCPError } from './domain-errors.js';

interface MCPErrorOptions {
  code?: ErrorCode;
  cause?: Error;
  context?: Record<string, unknown>;
}

/**
 * Tool execution error - maps to MCP error response
 */
export class ToolExecutionError extends MCPError {
  public readonly toolName: string;
  public readonly arguments_: Record<string, unknown>;

  constructor(
    toolName: string,
    arguments_: Record<string, unknown>,
    message: string,
    options?: MCPErrorOptions
  ) {
    super(
      options?.code ?? 'MCP_TOOL_EXECUTION_FAILED',
      message,
      { toolName, ...options?.context, cause: options?.cause }
    );
    this.toolName = toolName;
    this.arguments_ = arguments_;
  }
}

/**
 * Invalid tool arguments error
 */
export class InvalidToolArgumentsError extends MCPError {
  public readonly toolName: string;
  public readonly validationErrors: string[];

  constructor(
    toolName: string,
    validationErrors: string[],
    options?: MCPErrorOptions
  ) {
    const context = { toolName, validationErrors, ...options?.context };
    super(
      'MCP_INVALID_ARGUMENTS',
      `Invalid arguments for tool '${toolName}': ${validationErrors.join('; ')}`,
      { ...context, cause: options?.cause }
    );
    this.toolName = toolName;
    this.validationErrors = validationErrors;
  }
}

/**
 * Tool not found error
 */
export class ToolNotFoundError extends MCPError {
  public readonly toolName: string;
  public readonly availableTools: string[];

  constructor(
    toolName: string,
    availableTools: string[],
    options?: MCPErrorOptions
  ) {
    const context = { toolName, availableTools, ...options?.context };
    super(
      'MCP_TOOL_NOT_FOUND',
      `Tool '${toolName}' not found. Available tools: ${availableTools.join(', ')}`,
      { ...context, cause: options?.cause }
    );
    this.toolName = toolName;
    this.availableTools = availableTools;
  }
}

/**
 * Transport error (stdio, HTTP, SSE)
 */
export class TransportError extends MCPError {
  public readonly transport: string;

  constructor(
    transport: string,
    message: string,
    options?: MCPErrorOptions
  ) {
    const context = { transport, ...options?.context };
    super(
      options?.code ?? 'MCP_TRANSPORT_ERROR',
      `${transport} transport error: ${message}`,
      { ...context, cause: options?.cause }
    );
    this.transport = transport;
  }
}

/**
 * Protocol error (invalid JSON-RPC, etc.)
 */
export class ProtocolError extends MCPError {
  public readonly method?: string;
  public readonly requestId?: string | number;

  constructor(
    message: string,
    options?: { method?: string; requestId?: string | number; cause?: Error; context?: Record<string, unknown> }
  ) {
    super('MCP_PROTOCOL_ERROR', message, { ...options?.context, cause: options?.cause });
    this.method = options?.method;
    this.requestId = options?.requestId;
  }
}

/**
 * Convert any error to MCP-compatible error response
 */
export interface MCPErrorResponse {
  code: number;
  message: string;
  data?: Record<string, unknown>;
}

interface AppErrorLike {
  code: ErrorCode;
  errorId: string;
  isRetryable: boolean;
  context: Record<string, unknown>;
  statusCode: number;
  message: string;
}

export function toMCPErrorResponse(error: unknown): MCPErrorResponse {
  if (error instanceof ToolExecutionError) {
    return {
      code: -32603, // Internal error
      message: error.message,
      data: {
        errorId: error.errorId,
        toolName: error.toolName,
        code: error.code,
        context: error.context,
        retryable: error.isRetryable,
      },
    };
  }

  if (error instanceof InvalidToolArgumentsError) {
    return {
      code: -32602, // Invalid params
      message: error.message,
      data: {
        errorId: error.errorId,
        toolName: error.toolName,
        validationErrors: error.validationErrors,
      },
    };
  }

  if (error instanceof ToolNotFoundError) {
    return {
      code: -32601, // Method not found
      message: error.message,
      data: {
        errorId: error.errorId,
        toolName: error.toolName,
        availableTools: error.availableTools,
      },
    };
  }

  if (error instanceof TransportError) {
    return {
      code: -32603,
      message: error.message,
      data: {
        errorId: error.errorId,
        transport: error.transport,
        code: error.code,
        retryable: error.isRetryable,
      },
    };
  }

  if (error instanceof ProtocolError) {
    return {
      code: -32600, // Invalid request
      message: error.message,
      data: {
        errorId: error.errorId,
        method: error.method,
        requestId: error.requestId,
      },
    };
  }

  // Generic AppError
  if (error instanceof Error && 'code' in error && 'errorId' in error) {
    const appError = error as unknown as AppErrorLike;
    return {
      code: appError.statusCode >= 500 ? -32603 : -32000,
      message: error.message,
      data: {
        errorId: appError.errorId,
        code: appError.code,
        context: appError.context,
        retryable: appError.isRetryable,
      },
    };
  }

  // Unknown error
  return {
    code: -32603,
    message: error instanceof Error ? error.message : 'Unknown error',
    data: {
      errorId: crypto.randomUUID(),
      code: 'INTERNAL_ERROR',
    },
  };
}