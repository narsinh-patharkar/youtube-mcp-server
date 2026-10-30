# ADR 0004: Phase 3 - Summarization & LLM Integration

## Status

Accepted

## Phase

**Phase 3** (Week 3) - Summarization & LLM Integration

## Context

Generate AI-powered summaries from transcripts using multiple LLM providers with fallback support.

## Dependencies

- Phase 1: Foundation & Config (complete)
- Phase 2: Transcript Extraction (can run in parallel)

## Deliverables

### Domain Layer

```
src/domain/summary/
  ├── types.ts              # SummaryRequest, SummaryResult, SummaryStyle, SummaryOptions
  ├── ports.ts              # SummarizerPort, SummaryRepositoryPort
  └── prompts.ts            # Prompt templates per style
```

### Application Layer

```
src/application/services/summary.service.ts
src/application/use-cases/get-summary.use-case.ts
src/application/dto/summary.dto.ts
```

### Infrastructure Layer

```
src/infrastructure/llm/
  ├── claude.adapter.ts       # Anthropic SDK
  ├── openai.adapter.ts       # OpenAI SDK
  ├── ollama.adapter.ts       # Local Ollama
  ├── llm.router.ts           # Provider selection + fallback
  └── chunking.ts             # Map-reduce for long transcripts
```

### Tests

```
tests/unit/summarization/
  ├── claude.adapter.test.ts
  ├── openai.adapter.test.ts
  ├── ollama.adapter.test.ts
  ├── llm.router.test.ts
  ├── chunking.test.ts
  └── summary.service.test.ts

tests/integration/summarization/
  ├── summarization.integration.test.ts
  └── provider-fallback.integration.test.ts
```

## Implementation Details

### Summary Types

```typescript
type SummaryStyle = 'concise' | 'detailed' | 'technical' | 'action-items' | 'bullet-points';

interface SummaryRequest {
  videoId: string;
  transcript: TranscriptResult;
  style: SummaryStyle;
  maxLength?: number;
  customPrompt?: string;
}

interface SummaryResult {
  videoId: string;
  style: SummaryStyle;
  summary: string;
  keyPoints?: string[];
  timestamps?: Array<{ time: number; topic: string }>;
  generatedAt: Date;
  model: string;
  tokenUsage?: { input: number; output: number };
}
```

### Port Interface

```typescript
interface SummarizerPort {
  summarize(request: SummaryRequest): Promise<SummaryResult>;
  countTokens(text: string): number;
  getModel(): string;
  getProvider(): string;
  isAvailable(): Promise<boolean>;
}
```

### LLM Providers

| Provider   | SDK                 | Models                                  | Pros                         |
| ---------- | ------------------- | --------------------------------------- | ---------------------------- |
| **Claude** | `@anthropic-ai/sdk` | `claude-3-5-sonnet`, `claude-3-5-haiku` | Best quality, prompt caching |
| **OpenAI** | `openai`            | `gpt-4o`, `gpt-4o-mini`                 | Fast, streaming support      |
| **Ollama** | `ollama` (fetch)    | `llama3.1:8b`, `qwen2.5:7b`             | Free, local, private         |

### Provider Router

```typescript
class LLMRouter {
  // 1. Select provider from config (claude/openai/ollama)
  // 2. Verify provider availability
  // 3. Fallback chain: primary -> secondary -> tertiary
  // 4. Handle rate limits, quota, auth errors
}
```

### Chunking Strategy (Map-Reduce)

For transcripts exceeding token limits:

```
1. Split transcript into ~8k token chunks (with 500 token overlap)
2. Summarize each chunk in parallel (map)
3. Combine chunk summaries into final summary (reduce)
```

### Prompt Templates (5 Styles)

```typescript
const PROMPT_TEMPLATES = {
  concise: `Provide a concise 3-5 bullet point summary...`,
  detailed: `Provide comprehensive summary with key topics, main arguments, 
             actionable insights. Include timestamps where topics change.`,
  technical: `Focus on technical details: architecture decisions, code patterns, 
              tools, frameworks, implementation specifics.`,
  'action-items': `Extract all action items, resources mentioned, links, next steps. 
                   Format as checklist.`,
  'bullet-points': `Provide structured bullet-point summary organized by topic/theme.`,
};
```

### Token Management

- **Estimation**: ~4 chars = 1 token (rough)
- **Chunking threshold**: 100k tokens (configurable)
- **Chunk size**: 8k tokens (configurable)
- **Overlap**: 500 tokens (configurable)

## Consequences

### Positive

- Provider-agnostic abstraction enables easy switching
- Local Ollama option for privacy/cost-sensitive use cases
- Chunking handles arbitrarily long videos
- Prompt templates ensure consistent output quality
- Fallback chain increases reliability

### Negative

- Multiple provider SDKs increase bundle size
- Token estimation is approximate
- Prompt engineering required per provider

---

## Related

- ADR 0002: Phase 2 - Transcript Extraction
- ADR 0005: Phase 4 - MCP Server (next)
