/**
 * HttpTransport - HTTP transport for MCP server (Phase 5 placeholder)
 * For HTTP/SSE based clients
 */

import type { AppLogger } from '@core/logging/index.js';

/**
 * HttpTransport - HTTP transport for MCP server
 * Placeholder for Phase 5 implementation
 */
export class HttpTransport {
  private transport: any = null;
  private readonly logger: AppLogger;

  constructor(
    private readonly mcpServer: any,
    logger: AppLogger
  ) {
    this.logger = logger;
  }

  /**
   * Start the HTTP transport
   */
  async start(port: number = 3000): Promise<void> {
    this.logger.info('Starting HTTP transport (placeholder)', { port });

    // Placeholder for Phase 5 - would use Fastify/Express to serve HTTP
    this.logger.warn('HTTP transport not yet fully implemented - Phase 5');
  }

  /**
   * Stop the HTTP transport
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping HTTP transport');

    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }

    this.logger.info('HTTP transport stopped');
  }

  /**
   * Get transport status
   */
  isRunning(): boolean {
    return this.transport !== null;
  }
}