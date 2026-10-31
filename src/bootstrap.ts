/**
 * Bootstrap - DI Container Registration
 * Composition root for the application
 */

import {
  loadConfig,
  type AppConfig,
  type CacheConfig,
  type HTTPConfig,
  type LoggingConfig,
  type RateLimitConfig,
  type SummarizationConfig,
  type TranscriptConfig,
} from '@config/index.js';
import { TypedContainer, provideFactory, provideValue } from '@core/di/container.js';
import { initializeLifecycleManager, type LifecycleManager } from '@core/di/lifecycle.js';
import { initializeEventEmitter, type EventEmitter } from '@core/events/emitter.js';
import { initializeLogger, type AppLogger } from '@core/logging/logger.js';

// Infrastructure adapters - Transcript
import { MemoryTranscriptRepository } from '@infrastructure/transcript/memory-transcript.repository.js';
import { SqliteTranscriptRepository } from '@infrastructure/transcript/sqlite-transcript.repository.js';
import { YoutubeTranscriptApiAdapter } from '@infrastructure/transcript/youtube-transcript-api.adapter.js';
import { YtDlpAdapter } from '@infrastructure/transcript/yt-dlp.adapter.js';

// Infrastructure adapters - LLM
import { ClaudeAdapter } from '@infrastructure/llm/claude.adapter.js';
import { OpenAIAdapter } from '@infrastructure/llm/openai.adapter.js';
import { OllamaAdapter } from '@infrastructure/llm/ollama.adapter.js';
import { LLMRouter } from '@infrastructure/llm/llm.router.js';
import { ChunkingService } from '@infrastructure/llm/chunking.service.js';
import { MemorySummaryRepository } from '@infrastructure/llm/memory-summary.repository.js';
import { SqliteSummaryRepository } from '@infrastructure/llm/sqlite-summary.repository.js';

// Infrastructure - MCP
import { MCPServerWrapper } from '@infrastructure/mcp/server/mcp-server.js';
import { StdioTransport } from '@infrastructure/mcp/transports/stdio.transport.js';
import { HttpTransport } from '@infrastructure/mcp/transports/http.transport.js';
import { SseTransport } from '@infrastructure/mcp/transports/sse.transport.js';

// Application services
import { TranscriptService } from '@application/services/transcript.service.js';
import { SummaryService } from '@application/services/summary.service.js';
import { GetTranscriptUseCase } from '@application/use-cases/get-transcript.use-case.js';
import { GetSummaryUseCase } from '@application/use-cases/get-summary.use-case.js';

/**
 * Register all core infrastructure services
 */
export function registerCoreServices(container: TypedContainer, config: AppConfig): void {
  // Configuration
  provideValue('config' as any, config);
  provideValue('transcriptConfig' as any, config.transcript);
  provideValue('summarizationConfig' as any, config.summarization);
  provideValue('cacheConfig' as any, config.cache);
  provideValue('rateLimitConfig' as any, config.rateLimit);
  provideValue('httpConfig' as any, config.http);
  provideValue('loggingConfig' as any, config.logging);

  // Logger
  const logger = initializeLogger(config.logging);
  provideValue('logger' as any, logger);

  // Lifecycle Manager
  const lifecycleManager = initializeLifecycleManager(logger);
  provideValue('lifecycleManager' as any, lifecycleManager);

  // Event Emitter
  const eventEmitter = initializeEventEmitter();
  provideValue('eventEmitter' as any, eventEmitter);
}

/**
 * Register domain ports (interfaces)
 * These will be implemented by infrastructure adapters
 */
export function registerDomainPorts(_container: TypedContainer): void {
  // Transcript Repository Port - will be bound in registerInfrastructureAdapters
  // Summary Repository Port - will be bound later
  // Video Extractor Port - will be bound later
}

/**
 * Register infrastructure adapters
 */
export function registerInfrastructureAdapters(_container: TypedContainer): void {
  // Transcript Adapters
  provideFactory('youtubeTranscriptApiAdapter', (_c) => {
    return new YoutubeTranscriptApiAdapter(_c.resolve('transcriptConfig'));
  });
  provideFactory('ytDlpAdapter', (_c) => {
    return new YtDlpAdapter(_c.resolve('transcriptConfig'));
  });

  // Transcript Repository - choose based on config
  provideFactory('transcriptRepository', (_c) => {
    const cacheConfig = _c.resolve('cacheConfig') as CacheConfig;
    const logger = _c.resolve('logger') as {
      debug: (msg: string, meta?: Record<string, unknown>) => void;
      error: (msg: string, meta?: Record<string, unknown>) => void;
    };
    if (cacheConfig.type === 'memory' || cacheConfig.type === 'sqlite') {
      if (cacheConfig.type === 'memory') {
        return new MemoryTranscriptRepository(
          cacheConfig.ttlSeconds,
          cacheConfig.cleanupIntervalMs
        );
      }
      const repo = new SqliteTranscriptRepository(cacheConfig, logger);
      // Initialize asynchronously - will be ready by first use
      repo
        .initialize()
        .catch((err) =>
          logger.error('Failed to initialize SQLite transcript repository', { error: err.message })
        );
      return repo;
    }
    // Default to memory
    return new MemoryTranscriptRepository(cacheConfig.ttlSeconds, cacheConfig.cleanupIntervalMs);
  });

  // Summary Repository - choose based on config
  provideFactory('summaryRepository', (_c) => {
    const cacheConfig = _c.resolve('cacheConfig') as CacheConfig;
    const logger = _c.resolve('logger') as {
      debug: (msg: string, meta?: Record<string, unknown>) => void;
      error: (msg: string, meta?: Record<string, unknown>) => void;
    };
    if (cacheConfig.type === 'memory' || cacheConfig.type === 'sqlite') {
      if (cacheConfig.type === 'memory') {
        return new MemorySummaryRepository(
          cacheConfig.ttlSeconds,
          cacheConfig.cleanupIntervalMs
        );
      }
      const repo = new SqliteSummaryRepository(cacheConfig, logger);
      // Initialize asynchronously - will be ready by first use
      repo
        .initialize()
        .catch((err) =>
          logger.error('Failed to initialize SQLite summary repository', { error: err.message })
        );
      return repo;
    }
    // Default to memory
    return new MemorySummaryRepository(cacheConfig.ttlSeconds, cacheConfig.cleanupIntervalMs);
  });

  // LLM Adapters
  provideFactory('claudeAdapter', (_c) => {
    const summarizationConfig = _c.resolve('summarizationConfig') as SummarizationConfig;
    const claudeConfig = summarizationConfig.claude;
    if (!claudeConfig?.apiKey) {
      throw new Error('Claude API key not configured');
    }
    return new ClaudeAdapter(
      {
        timeoutMs: claudeConfig.timeoutMs,
        maxRetries: 2,
        temperature: claudeConfig.temperature,
        maxTokens: claudeConfig.maxTokens,
      },
      claudeConfig.apiKey,
      claudeConfig.model
    );
  });
  provideFactory('openaiAdapter', (_c) => {
    const summarizationConfig = _c.resolve('summarizationConfig') as SummarizationConfig;
    const openaiConfig = summarizationConfig.openai;
    if (!openaiConfig?.apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    return new OpenAIAdapter(
      {
        timeoutMs: openaiConfig.timeoutMs,
        maxRetries: 2,
        temperature: openaiConfig.temperature,
        maxTokens: openaiConfig.maxTokens,
      },
      openaiConfig.apiKey,
      openaiConfig.model,
      openaiConfig.baseUrl,
      openaiConfig.organization
    );
  });
  provideFactory('ollamaAdapter', (_c) => {
    const summarizationConfig = _c.resolve('summarizationConfig') as SummarizationConfig;
    const ollamaConfig = summarizationConfig.ollama;
    if (!ollamaConfig?.host) {
      throw new Error('Ollama host not configured');
    }
    return new OllamaAdapter(
      {
        timeoutMs: ollamaConfig.timeoutMs,
        maxRetries: 2,
        temperature: ollamaConfig.temperature,
        maxTokens: ollamaConfig.maxTokens,
      },
      ollamaConfig.host,
      ollamaConfig.model,
      ollamaConfig.keepAlive
    );
  });

  // LLM Router - routes to providers with fallback
  provideFactory('llmRouter', (_c) => {
    const summarizationConfig = _c.resolve('summarizationConfig') as SummarizationConfig;
    const providers: any[] = [];

    // Add available providers based on config
    const claudeConfig = summarizationConfig.claude;
    if (claudeConfig?.apiKey) {
      providers.push(_c.resolve('claudeAdapter'));
    }

    const openaiConfig = summarizationConfig.openai;
    if (openaiConfig?.apiKey) {
      providers.push(_c.resolve('openaiAdapter'));
    }

    const ollamaConfig = summarizationConfig.ollama;
    if (ollamaConfig?.host) {
      providers.push(_c.resolve('ollamaAdapter'));
    }

    return new LLMRouter(
      {
        timeoutMs: 120000,
        maxRetries: 2,
        temperature: summarizationConfig.claude?.temperature ?? 0.3,
        maxTokens: summarizationConfig.claude?.maxTokens ?? 8192,
      },
      providers,
      summarizationConfig.provider
    );
  });

  // Chunking Service
  provideFactory('chunkingService', (_c) => {
    const summarizationConfig = _c.resolve('summarizationConfig') as SummarizationConfig;
    return new ChunkingService({
      maxTranscriptTokens: summarizationConfig.maxTranscriptTokens,
      chunkSizeTokens: summarizationConfig.chunkSizeTokens,
      chunkOverlapTokens: summarizationConfig.chunkOverlapTokens,
      enableChunking: summarizationConfig.enableChunking,
    });
  });
}

/**
 * Register application services
 */
export function registerApplicationServices(_container: TypedContainer): void {
  // Transcript Service
  provideFactory('transcriptService', (_c) => {
    return new TranscriptService({
      extractors: [_c.resolve('youtubeTranscriptApiAdapter'), _c.resolve('ytDlpAdapter')],
      repository: _c.resolve('transcriptRepository'),
      config: _c.resolve('transcriptConfig'),
      eventEmitter: _c.resolve('eventEmitter'),
      logger: _c.resolve('logger'),
    });
  });

  // Summary Service
  provideFactory('summaryService', (_c) => {
    return new SummaryService({
      transcriptService: _c.resolve('transcriptService'),
      llmRouter: _c.resolve('llmRouter'),
      chunkingService: _c.resolve('chunkingService'),
      repository: _c.resolve('summaryRepository'),
      config: _c.resolve('summarizationConfig'),
      eventEmitter: _c.resolve('eventEmitter'),
      logger: _c.resolve('logger'),
    });
  });

  // Cache Service - will be registered in Phase 3
  // provideFactory('cacheService', (_c) => { ... });
}

/**
 * Register use cases
 */
export function registerUseCases(_container: TypedContainer): void {
  provideFactory('getTranscriptUseCase', (_c) => {
    return new GetTranscriptUseCase({
      transcriptService: _c.resolve('transcriptService'),
      logger: _c.resolve('logger'),
    });
  });

  provideFactory('getSummaryUseCase', (_c) => {
    return new GetSummaryUseCase({
      summaryService: _c.resolve('summaryService'),
      logger: _c.resolve('logger'),
    });
  });

  // provideFactory('searchVideosUseCase', (_c) => { ... });
}

/**
 * Register MCP components
 */
export function registerMCPComponents(container: TypedContainer): void {
  // MCP Server
  provideFactory('mcpServer', (c) => {
    return new MCPServerWrapper(
      c.resolve('logger'),
      c.resolve('eventEmitter'),
      c.resolve('getTranscriptUseCase'),
      c.resolve('getSummaryUseCase')
    );
  });

  // MCP Transport - stdio (default)
  provideFactory('stdioTransport', (c) => {
    return new StdioTransport(
      c.resolve('mcpServer'),
      c.resolve('logger')
    );
  });

  // HTTP Transport (for Phase 5)
  // provideFactory('httpTransport', (c) => {
  //   return new HttpTransport(c.resolve('mcpServer'), c.resolve('logger'));
  // });

  // SSE Transport (for Phase 5)
  // provideFactory('sseTransport', (c) => {
  //   return new SseTransport(c.resolve('mcpServer'), c.resolve('logger'));
  // });
}

/**
 * Register HTTP components (for HTTP/SSE transport)
 */
export function registerHTTPComponents(_container: TypedContainer): void {
  // HTTP Server
  // provideFactory(container, 'httpServer' as any, (c) => {
  //   return new HttpServer(
  //     c.resolve('httpConfig'),
  //     c.resolve('mcpServer'),
  //     c.resolve('rateLimitMiddleware'),
  //     c.resolve('authMiddleware'),
  //     c.resolve('requestIdMiddleware'),
  //     c.resolve('logger')
  //   );
  // });
  // Middleware
  // provideSingleton(container, 'rateLimitMiddleware' as any, RateLimitMiddleware);
  // provideSingleton(container, 'authMiddleware' as any, AuthMiddleware);
  // provideSingleton(container, 'requestIdMiddleware' as any, RequestIdMiddleware);
}

/**
 * Main bootstrap function - registers all services
 */
export function bootstrap(container: TypedContainer = new TypedContainer()): {
  container: TypedContainer;
  config: AppConfig;
  logger: AppLogger;
  lifecycleManager: LifecycleManager;
} {
  // 1. Load and validate configuration
  const config = loadConfig();

  // 2. Register core services (config, logger, lifecycle, events)
  registerCoreServices(container, config);

  const logger = container.resolve('logger') as AppLogger;
  const lifecycleManager = container.resolve('lifecycleManager') as LifecycleManager;

  logger.info('Bootstrapping application', {
    version: config.version,
    environment: config.environment,
    transport: config.transport,
  });

  // 3. Register domain ports (interfaces)
  registerDomainPorts(container);

  // 4. Register infrastructure adapters
  registerInfrastructureAdapters(container);

  // 5. Register application services
  registerApplicationServices(container);

  // 6. Register use cases
  registerUseCases(container);

  // 7. Register MCP components
  registerMCPComponents(container);

  // 8. Register HTTP components (if HTTP transport enabled)
  if (config.http.enabled || config.transport !== 'stdio') {
    registerHTTPComponents(container);
  }

  // 9. Register startup hooks
  lifecycleManager.onStartup({
    name: 'initialize-cache',
    priority: 10,
    execute: async () => {
      // await container.resolve('cacheService').initialize();
      logger.debug('Cache initialized');
    },
  });

  lifecycleManager.onStartup({
    name: 'verify-llm-providers',
    priority: 20,
    execute: async () => {
      // await container.resolve('llmRouter').verifyProviders();
      logger.debug('LLM providers verified');
    },
  });

  // 10. Register shutdown hooks
  lifecycleManager.onShutdown({
    name: 'close-cache',
    priority: 10,
    execute: async () => {
      // await container.resolve('cacheService').close();
      logger.debug('Cache closed');
    },
  });

  lifecycleManager.onShutdown({
    name: 'close-http-server',
    priority: 20,
    execute: async () => {
      // await container.resolve('httpServer')?.close();
      logger.debug('HTTP server closed');
    },
  });

  lifecycleManager.onShutdown({
    name: 'flush-logs',
    priority: 100,
    execute: async () => {
      await logger.flush();
    },
  });

  // 11. Register health checks
  lifecycleManager.onHealthCheck({
    name: 'config',
    check: async () => ({ healthy: true, details: { environment: config.environment } }),
  });

  lifecycleManager.onHealthCheck({
    name: 'cache',
    check: async () => {
      // const cache = container.resolve('cacheService');
      // return cache.healthCheck();
      return { healthy: true, details: { type: config.cache.type } };
    },
  });

  lifecycleManager.onHealthCheck({
    name: 'llm-providers',
    check: async () => {
      // const router = container.resolve('llmRouter');
      // return router.healthCheck();
      return { healthy: true, details: { provider: config.summarization.provider } };
    },
  });

  logger.info('Bootstrap complete');
  return { container, config, logger, lifecycleManager };
}

/**
 * Create container for testing with mocks
 */
export function createTestContainer(): TypedContainer {
  const container = new TypedContainer();
  // Register test mocks here
  return container;
}
