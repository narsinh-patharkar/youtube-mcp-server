/**
 * MCPServer - Wrapper around @modelcontextprotocol/sdk McpServer
 * Handles tool registration and connection lifecycle
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { EventEmitter } from '@core/events/emitter.js';
import type { AppLogger } from '@core/logging/index.js';
import { GetTranscriptUseCase } from '@application/use-cases/get-transcript.use-case.js';
import { GetSummaryUseCase } from '@application/use-cases/get-summary.use-case.js';
import { Transcript } from '@domain/transcript/transcript.js';
import { Summary } from '@domain/summary/summary.js';
import { getDefaultSummaryStyle } from '@domain/summary/summary-style.js';
import type { SummaryStyle } from '@domain/summary/summary-style.js';

/**
 * MCP Tool definitions
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

/**
 * MCP Server wrapper
 */
export class MCPServerWrapper {
  private readonly server: McpServer;
  private readonly logger: AppLogger;
  private readonly eventEmitter: EventEmitter;
  private stdioTransport: StdioServerTransport | null = null;
  private httpTransport: StreamableHTTPServerTransport | null = null;
  private sseTransport: SSEServerTransport | null = null;

  constructor(
    logger: AppLogger,
    eventEmitter: EventEmitter,
    private readonly getTranscriptUseCase: GetTranscriptUseCase,
    private readonly getSummaryUseCase: GetSummaryUseCase
  ) {
    this.logger = logger;
    this.eventEmitter = eventEmitter;

    this.server = new McpServer(
      {
        name: 'youtube-transcript-summary',
        version: '1.0.0',
      },
      {
        capabilities: {
          logging: {},
          tools: {},
        },
        instructions: `YouTube Transcript & Summary MCP Server

Provides tools for:
- Extracting transcripts from YouTube videos with multiple format support
- Generating AI-powered summaries with configurable styles
- Searching YouTube videos (requires YouTube Data API key)

All tools accept YouTube video URLs or video IDs.`,
      }
    );

    this.registerTools();
  }

  /**
   * Register all MCP tools
   */
  private registerTools(): void {
    this.registerTranscriptTool();
    this.registerSummaryTool();
    // Search tool would be registered here when YouTube Data API is configured
  }

  /**
   * Register get_transcript tool
   */
  private registerTranscriptTool(): void {
    this.server.tool(
      'get_transcript',
      'Extract transcript from a YouTube video with timestamps and multiple format options',
      {
        url: z.string().describe('YouTube video URL or video ID'),
        language: z.string().describe('Preferred language code (e.g., en, es, fr)').default('en'),
        format: z.enum(['text', 'json', 'srt', 'vtt']).describe('Output format for transcript').default('text'),
        forceRefresh: z.boolean().describe('Force refresh cache').default(false),
      },
      async (args) => {
        const startTime = Date.now();
        this.eventEmitter.emit('tool:invoked', { tool: 'get_transcript', args });

        try {
          const result = await this.getTranscriptUseCase.execute({
            videoIdOrUrl: args.url as string,
            language: args.language as string,
            forceRefresh: args.forceRefresh as boolean,
          });

          if (!result.ok) {
            this.eventEmitter.emit('tool:failed', {
              tool: 'get_transcript',
              error: result.error.code,
            });
            throw result.error;
          }

          const { transcript, fromCache } = result.value;
          const formattedOutput = this.formatTranscript(transcript, args.format as string);

          this.eventEmitter.emit('tool:completed', {
            tool: 'get_transcript',
            duration: Date.now() - startTime,
            fromCache,
            segmentCount: transcript.segmentCount,
          });

          return {
            content: [
              {
                type: 'text',
                text: formattedOutput,
              },
            ],
            isError: false,
          };
        } catch (error) {
          this.logger.error('get_transcript tool failed', {
            error: error instanceof Error ? error.message : String(error),
            args,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Register get_summary tool
   */
  private registerSummaryTool(): void {
    this.server.tool(
      'get_summary',
      'Generate AI-powered summary of a YouTube video with configurable style and length',
      {
        url: z.string().describe('YouTube video URL or video ID'),
        style: z.enum(['concise', 'detailed', 'technical', 'action-items', 'bullet-points']).describe('Summary style').default('detailed'),
        maxLength: z.number().describe('Maximum summary length in characters').default(2000),
        customPrompt: z.string().optional().describe('Custom prompt to guide summarization'),
        forceRefresh: z.boolean().describe('Force refresh cache').default(false),
      },
      async (args) => {
        const startTime = Date.now();
        this.eventEmitter.emit('tool:invoked', { tool: 'get_summary', args });

        try {
          const style = (args.style as SummaryStyle) ?? getDefaultSummaryStyle();
          const result = await this.getSummaryUseCase.execute({
            videoIdOrUrl: args.url as string,
            style,
            forceRefresh: args.forceRefresh as boolean,
            customPrompt: args.customPrompt as string,
          });

          if (!result.ok) {
            this.eventEmitter.emit('tool:failed', {
              tool: 'get_summary',
              error: result.error.code,
            });
            throw result.error;
          }

          const { summary, fromCache } = result.value;
          const formattedOutput = this.formatSummary(summary, args.maxLength as number);

          this.eventEmitter.emit('tool:completed', {
            tool: 'get_summary',
            duration: Date.now() - startTime,
            fromCache,
            wordCount: summary.wordCount,
          });

          return {
            content: [
              {
                type: 'text',
                text: formattedOutput,
              },
            ],
            isError: false,
          };
        } catch (error) {
          this.logger.error('get_summary tool failed', {
            error: error instanceof Error ? error.message : String(error),
            args,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Format transcript in requested format
   */
  private formatTranscript(transcript: Transcript, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(transcript.toJSON(), null, 2);

      case 'srt':
        return this.toSRT(transcript);

      case 'vtt':
        return this.toVTT(transcript);

      case 'text':
      default:
        return this.toText(transcript);
    }
  }

  /**
   * Format as plain text with timestamps
   */
  private toText(transcript: Transcript): string {
    const lines = [
      `Video ID: ${transcript.videoId.value}`,
      `Language: ${transcript.language.code}`,
      `Source: ${transcript.source}`,
      `Duration: ${transcript.durationFormatted}`,
      `Segments: ${transcript.segmentCount}`,
      `Auto-generated: ${transcript.isAutoGenerated ? 'Yes' : 'No'}`,
      `Fetched: ${transcript.fetchedAt.toISOString()}`,
      '',
      'TRANSCRIPT:',
      '',
    ];

    for (const segment of transcript.segments) {
      lines.push(`[${segment.startFormatted}] ${segment.text}`);
    }

    return lines.join('\n');
  }

  /**
   * Format as SRT subtitle format
   */
  private toSRT(transcript: Transcript): string {
    const lines: string[] = [];

    for (let i = 0; i < transcript.segments.length; i++) {
      const segment = transcript.segments[i];
      const start = this.formatSRTTime(segment.start);
      const end = this.formatSRTTime(segment.end);

      lines.push(
        String(i + 1),
        `${start} --> ${end}`,
        segment.text,
        ''
      );
    }

    return lines.join('\n');
  }

  /**
   * Format as WebVTT format
   */
  private toVTT(transcript: Transcript): string {
    const lines = ['WEBVTT', ''];

    for (const segment of transcript.segments) {
      const start = this.formatVTTTime(segment.start);
      const end = this.formatVTTTime(segment.end);

      lines.push(
        `${start} --> ${end}`,
        segment.text,
        ''
      );
    }

    return lines.join('\n');
  }

  /**
   * Format time as HH:MM:SS,mmm for SRT
   */
  private formatSRTTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Format time as HH:MM:SS.mmm for VTT
   */
  private formatVTTTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Format summary as markdown
   */
  private formatSummary(summary: Summary, maxLength: number): string {
    const lines = [
      `# Summary: ${summary.style.charAt(0).toUpperCase() + summary.style.slice(1)}`,
      '',
      summary.summary,
      '',
    ];

    if (summary.keyPoints.length > 0) {
      lines.push('## Key Points', '');
      for (const point of summary.keyPoints) {
        lines.push(`- ${point}`);
      }
      lines.push('');
    }

    if (summary.timestamps.length > 0) {
      lines.push('## Timestamps', '');
      for (const ts of summary.timestamps) {
        const mins = Math.floor(ts.time / 60);
        const secs = Math.floor(ts.time % 60);
        lines.push(`- ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} - ${ts.topic}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push(`*Model: ${summary.model} | Source: ${summary.source} | Words: ${summary.wordCount}*`);

    let output = lines.join('\n');
    if (output.length > maxLength) {
      output = output.substring(0, maxLength - 3) + '...';
    }

    return output;
  }

  /**
   * Connect using stdio transport
   */
  async connectStdio(): Promise<void> {
    this.stdioTransport = new StdioServerTransport();
    await this.server.connect(this.stdioTransport);
    this.logger.info('MCP server connected via stdio transport');
  }

  /**
   * Connect using HTTP transport (for Phase 5)
   */
  async connectHTTP(port: number = 3000): Promise<void> {
    this.logger.info('HTTP transport not fully implemented - Phase 5');
    // Placeholder - would require Fastify/Express integration
    // this.httpTransport = new StreamableHTTPServerTransport({...});
    // await this.server.connect(this.httpTransport);
    // this.logger.info('MCP server connected via HTTP transport');
  }

  /**
   * Connect using SSE transport (for Phase 5)
   */
  async connectSSE(): Promise<void> {
    this.logger.info('SSE transport not fully implemented - Phase 5');
    // Placeholder - would require Fastify/Express integration
    // this.sseTransport = new SSEServerTransport('/messages', {...});
    // await this.server.connect(this.sseTransport);
    // this.logger.info('MCP server connected via SSE transport');
  }

  /**
   * Close all transports
   */
  async close(): Promise<void> {
    if (this.stdioTransport) {
      await this.stdioTransport.close();
      this.stdioTransport = null;
    }
    if (this.httpTransport) {
      await this.httpTransport.close();
      this.httpTransport = null;
    }
    if (this.sseTransport) {
      await this.sseTransport.close();
      this.sseTransport = null;
    }
    this.logger.info('MCP server transports closed');
  }

  /**
   * Get the underlying McpServer instance (for advanced use)
   */
  getServer(): McpServer {
    return this.server;
  }
}