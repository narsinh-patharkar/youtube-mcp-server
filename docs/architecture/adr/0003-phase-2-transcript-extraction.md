# ADR 0003: Phase 2 - Domain & Transcript Extraction

## Status

Accepted

## Phase

**Phase 2** (Week 2) - Domain & Transcript Extraction

## Context

Extract transcripts from YouTube videos reliably using multiple providers with caching.

## Dependencies

- Phase 1: Foundation & Config (complete)

## Deliverables

### Domain Layer

```
src/domain/video/
  ├── types.ts              # VideoId, VideoUrl value objects
  ├── extractors.ts         # URL parsing (all YouTube formats)
  └── validators.ts         # Video ID validation

src/domain/transcript/
  ├── types.ts              # TranscriptSegment, TranscriptResult, TranscriptOptions
  ├── ports.ts              # TranscriptExtractorPort, TranscriptRepositoryPort
  └── errors.ts             # TranscriptNotFound, TranscriptDisabled, TranscriptLanguageUnavailable
```

### Application Layer

```
src/application/services/transcript.service.ts
src/application/use-cases/get-transcript.use-case.ts
src/application/dto/transcript.dto.ts
```

### Infrastructure Layer

```
src/infrastructure/transcript/
  ├── youtube-transcript-api.adapter.ts   # Primary (fast, no binary)
  ├── yt-dlp.adapter.ts                   # Fallback (robust, needs yt-dlp binary)
  └── transcript.repository.ts            # Cache layer (implements Port)

src/infrastructure/cache/sqlite.repository.ts
```

### Tests

```
tests/unit/transcript/
  ├── video-extractors.test.ts
  ├── youtube-transcript-api.adapter.test.ts
  ├── yt-dlp.adapter.test.ts
  └── transcript.service.test.ts

tests/integration/transcript/
  ├── transcript-extraction.integration.test.ts
  └── cache-behavior.integration.test.ts
```

## Implementation Details

### Video Value Objects

```typescript
// VideoId - branded type for type safety
type VideoId = string & { readonly __brand: unique symbol };

// VideoUrl - validated YouTube URL
interface VideoUrl {
  readonly value: string;
  readonly videoId: VideoId;
}
```

### Transcript Types

```typescript
interface TranscriptSegment {
  text: string;
  start: number; // seconds
  duration: number; // seconds
}

interface TranscriptResult {
  videoId: string;
  language: string;
  segments: TranscriptSegment[];
  fullText: string;
  fetchedAt: Date;
  source: 'youtube-transcript-api' | 'yt-dlp';
}

interface TranscriptOptions {
  videoId: string;
  language?: string;
  useCache?: boolean;
}
```

### Ports (Interfaces)

```typescript
interface TranscriptExtractorPort {
  extract(options: TranscriptOptions): Promise<TranscriptResult>;
  getAvailableLanguages(videoId: string): Promise<string[]>;
  isAvailable(): Promise<boolean>;
}

interface TranscriptRepositoryPort {
  get(key: string): Promise<TranscriptResult | null>;
  set(key: string, value: TranscriptResult, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<boolean>;
}
```

### Extraction Strategy

1. **Check cache** (instant if hit)
2. **Try youtube-transcript-api** (fast, no binary dependency)
3. **Fallback to yt-dlp** (robust, handles restricted videos)
4. **Save to cache** (TTL: 7 days default)

### Supported YouTube URL Formats

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- `youtube.com/watch?v=VIDEO_ID&t=123`

## Consequences

### Positive

- Reliable extraction with automatic fallback
- Caching reduces API calls and improves latency
- Clean separation of concerns (ports/adapters)
- Easy to add new extraction methods

### Negative

- Requires yt-dlp binary for fallback (Docker handles this)
- Cache invalidation strategy needed for updates

---

## Related

- ADR 0001: Project Structure
- ADR 0002: Phase 1 - Foundation
- ADR 0004: Phase 3 - Summarization (next)
