/**
 * Dependency Injection Tokens - Symbol-based tokens for type-safe DI
 */

import type {
  AppConfig,
  CacheConfig,
  HTTPConfig,
  LoggingConfig,
  RateLimitConfig,
  SummarizationConfig,
  TranscriptConfig,
} from '@config/schema.js';
import type { AppLogger } from '@core/logging/index.js';

// ============================================================================
// Configuration Tokens
// ============================================================================

export const CONFIG_TOKEN = Symbol('config');
export const TRANSCRIPT_CONFIG_TOKEN = Symbol('transcriptConfig');
export const SUMMARIZATION_CONFIG_TOKEN = Symbol('summarizationConfig');
export const CACHE_CONFIG_TOKEN = Symbol('cacheConfig');
export const RATE_LIMIT_CONFIG_TOKEN = Symbol('rateLimitConfig');
export const HTTP_CONFIG_TOKEN = Symbol('httpConfig');
export const LOGGING_CONFIG_TOKEN = Symbol('loggingConfig');

// ============================================================================
// Core Service Tokens
// ============================================================================

export const LOGGER_TOKEN = Symbol('logger');
export const EVENT_EMITTER_TOKEN = Symbol('eventEmitter');

// ============================================================================
// Domain Service Tokens (Ports)
// ============================================================================

export const TRANSCRIPT_REPOSITORY_TOKEN = Symbol('transcriptRepository');
export const SUMMARY_REPOSITORY_TOKEN = Symbol('summaryRepository');
export const VIDEO_EXTRACTOR_TOKEN = Symbol('videoExtractor');

// ============================================================================
// Infrastructure Adapter Tokens
// ============================================================================

export const YOUTUBE_TRANSCRIPT_API_ADAPTER_TOKEN = Symbol('youtubeTranscriptApiAdapter');
export const YT_DLP_ADAPTER_TOKEN = Symbol('ytDlpAdapter');
export const CLAUDE_ADAPTER_TOKEN = Symbol('claudeAdapter');
export const OPENAI_ADAPTER_TOKEN = Symbol('openaiAdapter');
export const OLLAMA_ADAPTER_TOKEN = Symbol('ollamaAdapter');
export const LLM_ROUTER_TOKEN = Symbol('llmRouter');
export const CHUNKING_SERVICE_TOKEN = Symbol('chunkingService');
export const SQLITE_REPOSITORY_TOKEN = Symbol('sqliteRepository');
export const REDIS_REPOSITORY_TOKEN = Symbol('redisRepository');
export const MEMORY_REPOSITORY_TOKEN = Symbol('memoryRepository');

// ============================================================================
// Application Service Tokens
// ============================================================================

export const TRANSCRIPT_SERVICE_TOKEN = Symbol('transcriptService');
export const SUMMARY_SERVICE_TOKEN = Symbol('summaryService');
export const CACHE_SERVICE_TOKEN = Symbol('cacheService');

// ============================================================================
// Use Case Tokens
// ============================================================================

export const GET_TRANSCRIPT_USE_CASE_TOKEN = Symbol('getTranscriptUseCase');
export const GET_SUMMARY_USE_CASE_TOKEN = Symbol('getSummaryUseCase');
export const SEARCH_VIDEOS_USE_CASE_TOKEN = Symbol('searchVideosUseCase');

// ============================================================================
// MCP Tokens
// ============================================================================

export const MCP_SERVER_TOKEN = Symbol('mcpServer');
export const TRANSCRIPT_TOOL_TOKEN = Symbol('transcriptTool');
export const SUMMARY_TOOL_TOKEN = Symbol('summaryTool');
export const SEARCH_TOOL_TOKEN = Symbol('searchTool');
export const STDIO_TRANSPORT_TOKEN = Symbol('stdioTransport');
export const HTTP_TRANSPORT_TOKEN = Symbol('httpTransport');
export const SSE_TRANSPORT_TOKEN = Symbol('sseTransport');

// ============================================================================
// HTTP Tokens
// ============================================================================

export const HTTP_SERVER_TOKEN = Symbol('httpServer');
export const RATE_LIMIT_MIDDLEWARE_TOKEN = Symbol('rateLimitMiddleware');
export const AUTH_MIDDLEWARE_TOKEN = Symbol('authMiddleware');
export const REQUEST_ID_MIDDLEWARE_TOKEN = Symbol('requestIdMiddleware');

// ============================================================================
// Token Type Map (for TypeScript inference)
// ============================================================================

export interface TokenMap {
  [CONFIG_TOKEN]: AppConfig;
  [TRANSCRIPT_CONFIG_TOKEN]: TranscriptConfig;
  [SUMMARIZATION_CONFIG_TOKEN]: SummarizationConfig;
  [CACHE_CONFIG_TOKEN]: CacheConfig;
  [RATE_LIMIT_CONFIG_TOKEN]: RateLimitConfig;
  [HTTP_CONFIG_TOKEN]: HTTPConfig;
  [LOGGING_CONFIG_TOKEN]: LoggingConfig;

  [LOGGER_TOKEN]: AppLogger;

  [TRANSCRIPT_REPOSITORY_TOKEN]: unknown; // TranscriptRepositoryPort
  [SUMMARY_REPOSITORY_TOKEN]: unknown; // SummaryRepositoryPort
  [VIDEO_EXTRACTOR_TOKEN]: unknown; // VideoExtractorPort

  [YOUTUBE_TRANSCRIPT_API_ADAPTER_TOKEN]: unknown; // YoutubeTranscriptApiAdapter
  [YT_DLP_ADAPTER_TOKEN]: unknown; // YtDlpAdapter
  [CLAUDE_ADAPTER_TOKEN]: unknown; // ClaudeAdapter
  [OPENAI_ADAPTER_TOKEN]: unknown; // OpenAIAdapter
  [OLLAMA_ADAPTER_TOKEN]: unknown; // OllamaAdapter
  [LLM_ROUTER_TOKEN]: unknown; // LLMRouter
  [CHUNKING_SERVICE_TOKEN]: unknown; // ChunkingService
  [SQLITE_REPOSITORY_TOKEN]: unknown; // SqliteRepository
  [REDIS_REPOSITORY_TOKEN]: unknown; // RedisRepository
  [MEMORY_REPOSITORY_TOKEN]: unknown; // MemoryRepository

  [TRANSCRIPT_SERVICE_TOKEN]: unknown; // TranscriptService
  [SUMMARY_SERVICE_TOKEN]: unknown; // SummaryService
  [CACHE_SERVICE_TOKEN]: unknown; // CacheService

  [GET_TRANSCRIPT_USE_CASE_TOKEN]: unknown; // GetTranscriptUseCase
  [GET_SUMMARY_USE_CASE_TOKEN]: unknown; // GetSummaryUseCase
  [SEARCH_VIDEOS_USE_CASE_TOKEN]: unknown; // SearchVideosUseCase

  [MCP_SERVER_TOKEN]: unknown; // MCPServer
  [TRANSCRIPT_TOOL_TOKEN]: unknown; // TranscriptTool
  [SUMMARY_TOOL_TOKEN]: unknown; // SummaryTool
  [SEARCH_TOOL_TOKEN]: unknown; // SearchTool
  [STDIO_TRANSPORT_TOKEN]: unknown; // StdioTransport
  [HTTP_TRANSPORT_TOKEN]: unknown; // HttpTransport
  [SSE_TRANSPORT_TOKEN]: unknown; // SseTransport

  [HTTP_SERVER_TOKEN]: unknown; // HttpServer
  [RATE_LIMIT_MIDDLEWARE_TOKEN]: unknown; // RateLimitMiddleware
  [AUTH_MIDDLEWARE_TOKEN]: unknown; // AuthMiddleware
  [REQUEST_ID_MIDDLEWARE_TOKEN]: unknown; // RequestIdMiddleware
}
