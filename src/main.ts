/**
 * Main Entry Point - Application Composition Root
 *
 * This is the only file that should import from all layers.
 * It wires together the complete application.
 */

import { bootstrap } from './bootstrap.js';
import { getLogger } from '@core/logging/logger.js';
import { getLifecycleManager } from '@core/di/lifecycle.js';

async function main(): Promise<void> {
  try {
    // Bootstrap the application
    const { container, config, lifecycleManager } = await bootstrap();

    const logger = getLogger();

    // Start the application (run startup hooks)
    await lifecycleManager.start();

    logger.info('Application started', {
      name: config.name,
      version: config.version,
      transport: config.transport,
      environment: config.environment,
    });

    // Handle transport
    if (config.transport === 'stdio') {
      // Stdio transport is handled by MCP server directly
      // The server will be started when tools are invoked
      logger.info('MCP server ready on stdio transport');
    } else if (config.transport === 'http' || config.transport === 'sse') {
      // HTTP/SSE transport
      // const httpServer = container.resolve('httpServer');
      // await httpServer.start();
      logger.info('HTTP/SSE transport not yet implemented', { transport: config.transport });
    }

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await lifecycleManager.stop();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Shutdown failed', { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.fatal('Uncaught exception', { error: error.message, stack: error.stack });
      lifecycleManager.stop().finally(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason) => {
      logger.fatal('Unhandled rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
      lifecycleManager.stop().finally(() => process.exit(1));
    });

    // Keep process alive for stdio transport
    if (config.transport === 'stdio') {
      // For stdio, the process stays alive until parent terminates it
      // or we receive a shutdown signal
      await new Promise(() => {}); // Wait forever
    }

  } catch (error) {
    // Fallback logging if bootstrap fails
    const logger = getLogger();
    logger.fatal('Failed to start application', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Run if this is the main module
main();