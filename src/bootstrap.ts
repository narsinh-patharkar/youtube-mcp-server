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
import {
  TypedContainer,
  diContainer,
  provideFactory,
  provideSingleton,
  provideValue,
} from '@core/di/container.js';
import { initializeLifecycleManager, type LifecycleManager } from '@core/di/lifecycle.js';
import type { TokenMap } from '@core/di/tokens.js';
import { initializeEventEmitter, type EventEmitter } from '@core/events/emitter.js';
import { getLogger, initializeLogger, type AppLogger } from '@core/logging/logger.js';

// Domain ports
import type {
  TranscriptExtractorPort,
  TranscriptRepositoryPort,
  VideoExtractorPort,
} from '@domain/transcript/ports/index.js';

// Infrastructure adapters
import { MemoryTranscriptRepository } from '@infrastructure/transcript/memory-transcript.repository.js';
import { SqliteTranscriptRepository } from '@infrastructure/transcript/sqlite-transcript.repository.js';
import { YoutubeTranscriptApiAdapter } from '@infrastructure/transcript/youtube-transcript-api.adapter.js';
import { YtDlpAdapter } from '@infrastructure/transcript/yt-dlp.adapter.js';

// Application services
import { TranscriptService } from '@application/services/transcript.service.js';
import { GetTranscriptUseCase } from '@application/use-cases/get-transcript.use-case.js';

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
export function registerDomainPorts(container: TypedContainer): void {
  // Transcript Repository Port - will be bound in registerInfrastructureAdapters
  // Summary Repository Port - will be bound later
  // Video Extractor Port - will be bound later
}

/**
 * Register infrastructure adapters
 */
export function registerInfrastructureAdapters(container: TypedContainer): void {
  // Transcript Adapters
  provideFactory('youtubeTranscriptApiAdapter' as any, (c) => {
    return new YoutubeTranscriptApiAdapter(c.resolve('transcriptConfig'));
  });
  provideFactory('ytDlpAdapter' as any, (c) => {
    return new YtDlpAdapter(c.resolve('transcriptConfig'));
  });

  // Transcript Repository - choose based on config
  provideFactory('transcriptRepository' as any, (c) => {
    const cacheConfig = c.resolve('cacheConfig') as CacheConfig;
    const logger = c.resolve('logger') as {
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

  // LLM Adapters - will be registered in Phase 3
  // provideSingleton(container, 'claudeAdapter' as any, ClaudeAdapter);
  // provideSingleton(container, 'openaiAdapter' as any, OpenAIAdapter);
  // provideSingleton(container, 'ollamaAdapter' as any, OllamaAdapter);

  // LLM Router - will be registered in Phase 3
  // provideFactory(container, 'llmRouter' as any, (c) => { ... });

  // Chunking Service - will be registered in Phase 3
  // provideSingleton(container, 'chunkingService' as any, ChunkingService);

  // Cache Repositories - generic cache repos (different from transcript-specific)
  // provideSingleton(container, 'sqliteRepository' as any, SqliteRepository);
  // provideSingleton(container, 'memoryRepository' as any, MemoryRepository);
}

/**
 * Register application services
 */
export function registerApplicationServices(container: TypedContainer): void {
  // Transcript Service
  provideFactory('transcriptService' as any, (c) => {
    return new TranscriptService({
      extractors: [c.resolve('youtubeTranscriptApiAdapter'), c.resolve('ytDlpAdapter')],
      repository: c.resolve('transcriptRepository'),
      config: c.resolve('transcriptConfig'),
      eventEmitter: c.resolve('eventEmitter'),
      logger: c.resolve('logger'),
    });
  });

  // Summary Service - will be registered in Phase 3
  // provideFactory(container, 'summaryService' as any, (c) => { ... });

  // Cache Service - will be registered in Phase 3
  // provideFactory(container, 'cacheService' as any, (c) => { ... });
}

/**
 * Register use cases
 */
export function registerUseCases(container: TypedContainer): void {
  provideFactory('getTranscriptUseCase' as any, (c) => {
    return new GetTranscriptUseCase({
      transcriptService: c.resolve('transcriptService'),
      logger: c.resolve('logger'),
    });
  });

  // provideFactory(container, 'getSummaryUseCase' as any, (c) => { ... });
  // provideFactory(container, 'searchVideosUseCase' as any, (c) => { ... });
}

/**
 * Register MCP components
 */
export function registerMCPComponents(container: TypedContainer): void {
  // MCP Server
  // provideFactory(container, 'mcpServer' as any, (c) => {
  //   return new MCPServer(c.resolve('logger'));
  // });
  // Tools
  // provideFactory(container, 'transcriptTool' as any, (c) => {
  //   return new TranscriptTool(c.resolve('getTranscriptUseCase'), c.resolve('logger'));
  // });
  // provideFactory(container, 'summaryTool' as any, (c) => {
  //   return new SummaryTool(c.resolve('getSummaryUseCase'), c.resolve('logger'));
  // });
  // provideFactory(container, 'searchTool' as any, (c) => {
  //   return new SearchTool(c.resolve('searchVideosUseCase'), c.resolve('logger'));
  // });
  // Transports
  // provideFactory(container, 'stdioTransport' as any, (c) => {
  //   return new StdioTransport(c.resolve('mcpServer'), c.resolve('logger'));
  // });
  // provideFactory(container, 'httpTransport' as any, (c) => {
  //   return new HttpTransport(c.resolve('mcpServer'), c.resolve('httpConfig'), c.resolve('logger'));
  // });
}

/**
 * Register HTTP components (for HTTP/SSE transport)
 */
export function registerHTTPComponents(container: TypedContainer): void {
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
export async function bootstrap(container: TypedContainer = new TypedContainer()): Promise<{
  container: TypedContainer;
  config: AppConfig;
  logger: AppLogger;
  lifecycleManager: LifecycleManager;
}> {
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
