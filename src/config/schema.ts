import { z } from 'zod';

/**
 * Configuration Schema - Single source of truth for all config
 * Validates at startup, fails fast with clear messages
 */

// ============================================================================
// Primitive Schemas
// ============================================================================

const LogLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);
const TransportSchema = z.enum(['stdio', 'http', 'sse']);
const CacheTypeSchema = z.enum(['sqlite', 'redis', 'memory']);
const TranscriptSourceSchema = z.enum(['youtube-transcript-api', 'yt-dlp']);
const LLMProviderSchema = z.enum(['claude', 'openai', 'ollama']);
const SummaryStyleSchema = z.enum(['concise', 'detailed', 'technical', 'action-items', 'bullet-points']);

// ============================================================================
// Nested Config Schemas
// ============================================================================

export const TranscriptConfigSchema = z.object({
  preferredSource: TranscriptSourceSchema.default('youtube-transcript-api'),
  fallbackToYtDlp: z.boolean().default(true),
  ytDlpPath: z.string().optional(),
  defaultLanguage: z.string().min(2).max(5).default('en'),
  timeoutMs: z.number().int().positive().default(30_000),
  maxRetries: z.number().int().min(0).max(5).default(2),
  userAgent: z.string().default('Mozilla/5.0 (compatible; YouTubeMCP/1.0)'),
});

export const LLMClaudeConfigSchema = z.object({
  apiKey: z.string().min(1).optional(),
  model: z.string().default('claude-3-5-sonnet-20241022'),
  maxTokens: z.number().int().positive().max(200_000).default(8192),
  temperature: z.number().min(0).max(2).default(0.3),
  baseUrl: z.string().url().optional(),
  timeoutMs: z.number().int().positive().default(120_000),
});

export const LLMOpenAIConfigSchema = z.object({
  apiKey: z.string().min(1).optional(),
  model: z.string().default('gpt-4o-mini'),
  maxTokens: z.number().int().positive().max(128_000).default(4096),
  temperature: z.number().min(0).max(2).default(0.3),
  baseUrl: z.string().url().optional(),
  timeoutMs: z.number().int().positive().default(120_000),
  organization: z.string().optional(),
});

export const LLMOllamaConfigSchema = z.object({
  host: z.string().url().default('http://localhost:11434'),
  model: z.string().default('llama3.1:8b'),
  maxTokens: z.number().int().positive().default(4096),
  temperature: z.number().min(0).max(2).default(0.3),
  timeoutMs: z.number().int().positive().default(180_000),
  keepAlive: z.string().default('5m'),
});

export const SummarizationConfigSchema = z.object({
  provider: LLMProviderSchema.default('claude'),
  claude: LLMClaudeConfigSchema.optional(),
  openai: LLMOpenAIConfigSchema.optional(),
  ollama: LLMOllamaConfigSchema.optional(),
  defaultStyle: SummaryStyleSchema.default('detailed'),
  maxTranscriptTokens: z.number().int().positive().default(100_000),
  chunkSizeTokens: z.number().int().positive().default(8000),
  chunkOverlapTokens: z.number().int().min(0).default(500),
  enableChunking: z.boolean().default(true),
  systemPrompt: z.string().optional(),
});

export const CacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  type: CacheTypeSchema.default('sqlite'),
  sqlitePath: z.string().default('./data/cache.db'),
  redisUrl: z.string().url().optional(),
  redisKeyPrefix: z.string().default('yt-mcp:'),
  ttlSeconds: z.number().int().positive().default(604_800), // 7 days
  maxEntries: z.number().int().positive().default(10_000),
  cleanupIntervalMs: z.number().int().positive().default(3_600_000), // 1 hour
  vacuumOnStartup: z.boolean().default(false),
});

export const RateLimitConfigSchema = z.object({
  enabled: z.boolean().default(true),
  requestsPerMinute: z.number().int().positive().default(30),
  requestsPerHour: z.number().int().positive().default(200),
  requestsPerDay: z.number().int().positive().default(1000),
  burstAllowance: z.number().int().min(0).default(5),
  keyPrefix: z.string().default('ratelimit:'),
});

export const HTTPConfigSchema = z.object({
  enabled: z.boolean().default(false),
  host: z.string().default('0.0.0.0'),
  port: z.number().int().min(1).max(65535).default(3000),
  cors: z.object({
    enabled: z.boolean().default(true),
    origin: z.union([z.string(), z.array(z.string())]).default('*'),
    credentials: z.boolean().default(false),
  }).optional(),
  auth: z.object({
    enabled: z.boolean().default(false),
    apiKeys: z.array(z.string()).default([]),
    headerName: z.string().default('x-api-key'),
  }).optional(),
  requestTimeoutMs: z.number().int().positive().default(30_000),
  bodyLimit: z.string().default('1mb'),
});

export const YouTubeDataAPIConfigSchema = z.object({
  enabled: z.boolean().default(false),
  apiKey: z.string().min(1).optional(),
  quotaPerDay: z.number().int().positive().default(10_000),
  timeoutMs: z.number().int().positive().default(10_000),
});

export const LoggingConfigSchema = z.object({
  level: LogLevelSchema.default('info'),
  prettyPrint: z.boolean().default(false),
  redactPaths: z.array(z.string()).default(['*.apiKey', '*.authorization', '*.cookie']),
  serializers: z.record(z.string()).default({}),
  dest: z.union([z.literal('stdout'), z.literal('stderr'), z.string()]).default('stdout'),
});

// ============================================================================
// Root Config Schema
// ============================================================================

export const AppConfigSchema = z.object({
  // Application
  name: z.string().default('youtube-mcp-server'),
  version: z.string().default('0.1.0'),
  environment: z.enum(['development', 'test', 'staging', 'production']).default('development'),

  // Transport
  transport: TransportSchema.default('stdio'),

  // Feature configs
  transcript: TranscriptConfigSchema.default({}),
  summarization: SummarizationConfigSchema.default({}),
  cache: CacheConfigSchema.default({}),
  rateLimit: RateLimitConfigSchema.default({}),
  http: HTTPConfigSchema.default({}),
  youtubeDataApi: YouTubeDataAPIConfigSchema.default({}),
  logging: LoggingConfigSchema.default({}),

  // Advanced
  gracefulShutdownTimeoutMs: z.number().int().positive().default(10_000),
  healthCheckIntervalMs: z.number().int().positive().default(30_000),
});

// ============================================================================
// Inferred Types
// ============================================================================

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type TranscriptConfig = z.infer<typeof TranscriptConfigSchema>;
export type SummarizationConfig = z.infer<typeof SummarizationConfigSchema>;
export type CacheConfig = z.infer<typeof CacheConfigSchema>;
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;
export type HTTPConfig = z.infer<typeof HTTPConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type LLMClaudeConfig = z.infer<typeof LLMClaudeConfigSchema>;
export type LLMOpenAIConfig = z.infer<typeof LLMOpenAIConfigSchema>;
export type LLMOllamaConfig = z.infer<typeof LLMOllamaConfigSchema>;

// ============================================================================
// Config Sections (for DI)
// ============================================================================

export const ConfigSections = {
  transcript: 'transcript',
  summarization: 'summarization',
  cache: 'cache',
  rateLimit: 'rateLimit',
  http: 'http',
  youtubeDataApi: 'youtubeDataApi',
  logging: 'logging',
} as const;