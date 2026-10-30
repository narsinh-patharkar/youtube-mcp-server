# ADR 0005: Phase 4 - MCP Server & Tools

## Status

Accepted

## Phase

**Phase 4** (Week 4) - MCP Server & Tools

## Context

Expose transcript extraction and summarization via Model Context Protocol (MCP) for AI assistants.

## Dependencies

- Phase 2: Transcript Extraction (complete)
- Phase 3: Summarization (complete)

## Deliverables

### MCP Infrastructure

```
src/infrastructure/mcp/
  ├── server.ts                 # MCP server wrapper
  ├── tools/
  │   ├── transcript.tool.ts    # get_transcript
  │   ├── summary.tool.ts       # get_summary
  │   └── search.tool.ts        # search_videos (optional)
  └── transports/
      ├── stdio.transport.ts    # Default for Claude Code
      └── (http/sse in Phase 5)
```

### Composition Root

```
src/bootstrap.ts                # DI registration (all phases)
src/main.ts                     # Entry point, transport selection
```

### Tests

```
tests/unit/mcp/
  ├── transcript.tool.test.ts
  ├── summary.tool.test.ts
  ├── mcp-server.test.ts
  └── stdio-transport.test.ts

tests/integration/mcp/
  ├── mcp-e2e.test.ts
  └── tool-invocation.integration.test.ts
```

## Implementation Details

### MCP Server Wrapper

```typescript
class MCPServerWrapper {
  private server: McpServer;

  constructor(private logger: AppLogger) {
    this.server = new McpServer({
      name: 'youtube-transcript-summary',
      version: '1.0.0',
    });
  }

  registerTool(tool: MCPTool): void { ... }
  async connect(transport: Transport): Promise<void> { ... }
}
```

### MCP Tools

#### 1. get_transcript

```typescript
{
  name: 'get_transcript',
  description: 'Extract transcript from a YouTube video with timestamps',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'YouTube video URL' },
      language: { type: 'string', description: 'Preferred language code (e.g., en, es, fr)', default: 'en' },
      format: { type: 'string', enum: ['text', 'json', 'srt', 'vtt'], default: 'text' },
    },
    required: ['url'],
  },
}
```

**Output Formats:**

- `text` - Plain text with timestamps: `[0.5s] Hello world`
- `json` - Full TranscriptResult JSON
- `srt` - SubRip subtitle format
- `vtt` - WebVTT subtitle format

#### 2. get_summary

```typescript
{
  name: 'get_summary',
  description: 'Generate AI-powered summary of a YouTube video',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'YouTube video URL' },
      style: {
        type: 'string',
        enum: ['concise', 'detailed', 'technical', 'action-items', 'bullet-points'],
        default: 'detailed'
      },
      maxLength: { type: 'number', description: 'Maximum summary length in characters', default: 2000 },
      customPrompt: { type: 'string', description: 'Custom summarization prompt' },
    },
    required: ['url'],
  },
}
```

**Output Structure:**

```markdown
# Summary: Detailed

This video covers TypeScript fundamentals...

## Key Points

- TypeScript adds static typing to JavaScript
- Interfaces define object shapes
- Generics enable reusable components

## Timestamps

- 0:03 - TypeScript Introduction
- 0:45 - Interfaces Deep Dive
- 2:00 - Generics Tutorial
```

#### 3. search_videos (Optional)

```typescript
{
  name: 'search_videos',
  description: 'Search YouTube for videos (requires YouTube Data API key)',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      maxResults: { type: 'number', default: 10, maximum: 50 },
      order: { type: 'string', enum: ['relevance', 'date', 'viewCount', 'rating'], default: 'relevance' },
    },
    required: ['query'],
  },
}
```

### Transport Layer

#### Stdio Transport (Default)

```typescript
class StdioTransport {
  constructor(
    private server: MCPServerWrapper,
    private logger: AppLogger
  ) {}

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
```

### Composition Root (main.ts)

```typescript
async function main(): Promise<void> {
  // 1. Load config
  const config = loadConfig();

  // 2. Bootstrap DI container
  const { container, lifecycleManager } = await bootstrap();

  // 3. Start lifecycle hooks
  await lifecycleManager.start();

  // 4. Handle transport
  if (config.transport === 'stdio') {
    const transport = container.resolve('stdioTransport');
    await transport.start();
  } else {
    // HTTP/SSE handled in Phase 5
  }

  // 5. Graceful shutdown
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
```

## Consequences

### Positive

- Clean separation: tools delegate to use cases
- Transport-agnostic MCP server
- Structured output formats for different use cases
- Extensible tool registration

### Negative

- MCP SDK learning curve
- Stdio transport limited to local use
- HTTP/SSE deferred to Phase 5

---

## Related

- ADR 0003: Phase 3 - Summarization
- ADR 0006: Phase 5 - HTTP/SSE & Production (next)
