# Getting Started

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0 (`corepack enable pnpm`)
- **Git**
- **yt-dlp** (optional, for fallback transcript extraction)

```bash
# Install yt-dlp (recommended)
pip install yt-dlp

# Or on macOS
brew install yt-dlp
```

## Quick Start

```bash
# Clone repository
git clone https://github.com/narsinh-patharkar/youtube-mcp-server.git
cd youtube-mcp-server

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
# At minimum, set one LLM provider:
# ANTHROPIC_API_KEY=sk-ant-...  (for Claude)
# OPENAI_API_KEY=sk-...         (for OpenAI)
# OLLAMA_HOST=http://localhost:11434  (for local Ollama)

# Build
pnpm build

# Test with Claude Code (stdio transport)
# Add to ~/.claude/settings.json:
# {
#   "mcpServers": {
#     "youtube": {
#       "command": "node",
#       "args": ["/full/path/to/youtube-mcp-server/dist/main.js"]
#     }
#   }
# }
```

## Development Workflow

```bash
# Start dev server with hot reload
pnpm dev

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run E2E tests (requires API keys)
pnpm test:e2e

# Lint & format
pnpm lint
pnpm format

# Type check
pnpm typecheck
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MCP_TRANSPORT` | No | `stdio` | `stdio`, `http`, or `sse` |
| `ANTHROPIC_API_KEY` | Yes* | - | Anthropic Claude API key |
| `OPENAI_API_KEY` | Yes* | - | OpenAI API key |
| `OLLAMA_HOST` | No | `http://localhost:11434` | Ollama server URL |
| `CACHE_TYPE` | No | `sqlite` | `sqlite`, `redis`, `memory` |
| `LOG_LEVEL` | No | `info` | `trace`, `debug`, `info`, `warn`, `error` |

*At least one LLM provider required

## Project Structure

```
youtube-mcp-server/
├── src/
│   ├── config/          # Configuration (Zod-validated)
│   ├── core/            # Cross-cutting (errors, logging, DI, events)
│   ├── domain/          # Pure business logic (entities, ports)
│   ├── application/     # Use cases, services, DTOs
│   ├── infrastructure/  # Adapters (LLM, cache, transcript, MCP, HTTP)
│   └── presentation/    # CLI entry point
├── tests/               # Unit, integration, E2E tests
├── scripts/             # Build, migration scripts
├── docker/              # Docker files
└── docs/                # Documentation
```

## Running with Docker

```bash
# Development
docker compose -f docker/docker-compose.yml up youtube-mcp-dev

# Production
docker compose -f docker/docker-compose.yml up -d youtube-mcp-server redis
```

## Testing with Real YouTube URLs

```bash
# Test transcript extraction
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_transcript","arguments":{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}},"id":1}'

# Test summarization
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_summary","arguments":{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","style":"detailed"}},"id":1}'
```

## Common Issues

### yt-dlp not found
```bash
# Install yt-dlp
pip install yt-dlp
# Or add to PATH
export PATH="$HOME/.local/bin:$PATH"
```

### SQLite permission errors
```bash
# Ensure data directory is writable
mkdir -p data
chmod 755 data
```

### API key errors
- Verify key is valid and has quota
- Check `.env` file is in project root
- Restart server after changing `.env`

## Next Steps

- Read [Architecture Overview](../architecture/adr/0001-project-structure.md)
- Explore [MCP Tools API](../api/mcp-tools.md)
- Check [Contributing Guide](contributing.md)