# ADR 0006: Phase 5 - HTTP/SSE & Production Hardening

## Status

Accepted

## Phase

**Phase 5** (Week 5) - HTTP/SSE Transport & Production Hardening

## Context

Enable remote access via HTTP/SSE and harden for production deployment.

## Dependencies

- Phase 4: MCP Server & Tools (complete)

## Deliverables

### HTTP/SSE Transports

```
src/infrastructure/mcp/transports/
  ├── http.transport.ts
  └── sse.transport.ts
```

### HTTP Server (Fastify)

```
src/infrastructure/http/
  ├── server.ts
  ├── middleware/
  │   ├── auth.ts              # API key authentication
  │   ├── rate-limit.ts        # Per-client rate limiting
  │   ├── cors.ts              # CORS configuration
  │   └── request-id.ts        # Request tracking
  └── routes/
      └── health.ts            # /health, /ready endpoints
```

### Production Features

- Graceful shutdown (SIGTERM/SIGINT)
- Health checks (config, cache, LLM providers)
- Structured logging in production
- Metrics endpoints
- Load testing

### Tests

```
tests/unit/http/
  ├── http-server.test.ts
  ├── auth-middleware.test.ts
  ├── rate-limit-middleware.test.ts
  └── health-routes.test.ts

tests/integration/http/
  ├── http-transport.integration.test.ts
  ├── sse-transport.integration.test.ts
  └── auth-rate-limit.integration.test.ts
```

## Implementation Details

### HTTP Transport (Streamable HTTP)

```typescript
// Uses @modelcontextprotocol/sdk StreamableHTTPServerTransport
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import Fastify from 'fastify';

class HttpTransport {
  private app: FastifyInstance;
  private transport: StreamableHTTPServerTransport;

  constructor(
    private mcpServer: MCPServerWrapper,
    private config: HTTPConfig
  ) {}

  async start(): Promise<void> {
    this.app = Fastify({ logger: false });

    // Middleware
    await this.app.register(cors, { origin: this.config.cors.origin });
    await this.app.register(rateLimit, {
      max: this.config.rateLimit.requestsPerMinute,
      timeWindow: 60_000,
    });

    if (this.config.auth.enabled) {
      this.app.addHook('onRequest', this.authHook);
    }

    this.app.addHook('onRequest', this.requestIdHook);

    // MCP endpoint
    this.app.all('/mcp', async (req, reply) => {
      await this.transport.handleRequest(req, reply, req.body);
    });

    // Health endpoint
    this.app.get('/health', this.healthHandler);
    this.app.get('/ready', this.readyHandler);

    await this.app.listen({ port: this.config.port, host: this.config.host });
  }

  private authHook = async (req: FastifyRequest, reply: FastifyReply) => {
    const apiKey = req.headers[this.config.auth.headerName];
    if (!this.config.auth.apiKeys.includes(apiKey)) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  };
}
```

### SSE Transport

```typescript
// Uses @modelcontextprotocol/sdk SSEServerTransport
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

class SseTransport {
  // Similar to HTTP but with SSE transport
  // Handles long-lived connections for streaming
}
```

### Health Checks

```typescript
// GET /health - Liveness probe
app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: config.version,
}));

// GET /ready - Readiness probe
app.get('/ready', async () => {
  const checks = await lifecycleManager.checkHealth();
  const status = checks.healthy ? 'ok' : 'degraded';
  return reply.code(checks.healthy ? 200 : 503).send({
    status,
    checks: checks.checks,
    timestamp: new Date().toISOString(),
  }));
});
```

### Middleware

#### Rate Limiting

```typescript
// Token bucket per client (by IP or API key)
class RateLimitMiddleware {
  private buckets = new Map<string, TokenBucket>();

  async checkLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
    // Token bucket algorithm with sliding window
  }
}
```

#### Request ID

```typescript
// Adds unique request ID to all logs
const requestIdHook = (req, reply, done) => {
  const requestId = req.headers['x-request-id'] || ulid();
  req.headers['x-request-id'] = requestId;
  reply.header('x-request-id', requestId);
  done();
};
```

### Graceful Shutdown

```typescript
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  // 1. Stop accepting new connections
  await httpServer.close();

  // 2. Run shutdown hooks (cache, HTTP server, logs)
  await lifecycleManager.stop();

  // 3. Force exit after timeout
  setTimeout(() => process.exit(1), config.gracefulShutdownTimeoutMs);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

### Production Logging

```typescript
// JSON format for log aggregation
{
  level: 'info',
  message: 'Request completed',
  requestId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  method: 'POST',
  path: '/mcp',
  statusCode: 200,
  durationMs: 145,
  timestamp: '2024-01-15T10:30:45.123Z'
}
```

### Load Testing

```bash
# Example with autocannon
autocannon -c 100 -d 30 -m POST -H "Content-Type: application/json" \
  -b '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_summary","arguments":{"url":"https://youtube.com/watch?v=..."}}}' \
  http://localhost:3000/mcp
```

## Consequences

### Positive

- Remote access via HTTP/SSE
- Production-ready with auth, rate limiting, health checks
- Graceful shutdown prevents data loss
- Observability via structured logging and health endpoints

### Negative

- Additional complexity (Fastify, middleware)
- More configuration options
- Need to manage certificates for HTTPS (reverse proxy recommended)

---

## Related

- ADR 0005: Phase 4 - MCP Server
- ADR 0007: Phase 6 - Release (next)
