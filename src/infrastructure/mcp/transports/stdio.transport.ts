/**
 * StdioTransport - STDIO transport for MCP server
 * Used by default for Claude Code and other stdio-based clients
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { AppLogger } from '@core/logging/index.js';
import { MCPServerWrapper } from '../server/mcp-server.js';

/**
 * StdioTransport - Wraps StdioServerTransport for lifecycle management
 */
export class StdioTransport {
  private transport: StdioServerTransport | null = null;
  private readonly logger: AppLogger;

  constructor(
    private readonly mcpServer: MCPServerWrapper,
    logger: AppLogger
  ) {
    this.logger = logger;
  }

  /**
   * Start the stdio transport
   */
  async start(): Promise<void> {
    this.logger.info('Starting stdio transport');

    this.transport = new StdioServerTransport();
    await this.mcpServer.connectStdio();

    this.logger.info('Stdio transport started');
  }

  /**
   * Stop the stdio transport
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping stdio transport');

    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }

    await this.mcpServer.close();
    this.logger.info('Stdio transport stopped');
  }

  /**
   * Get transport status
   */
  isRunning(): boolean {
    return this.transport !== null;
  }
}