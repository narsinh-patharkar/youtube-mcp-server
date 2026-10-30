/**
 * Domain Events - Application-wide event definitions
 */

// Video events
export interface VideoDiscoveredEvent {
  videoId: string;
  url: string;
  discoveredAt: Date;
}

export interface VideoMetadataFetchedEvent {
  videoId: string;
  title: string;
  duration: number;
  channel: string;
  fetchedAt: Date;
}

// Transcript events
export interface TranscriptRequestedEvent {
  videoId: string;
  language: string;
  requestedAt: Date;
}

export interface TranscriptFetchedEvent {
  videoId: string;
  language: string;
  segmentCount: number;
  durationMs: number;
  source: 'youtube-transcript-api' | 'yt-dlp' | 'cache';
  fetchedAt: Date;
}

export interface TranscriptFailedEvent {
  videoId: string;
  language: string;
  error: string;
  attemptedSources: string[];
  failedAt: Date;
}

// Summarization events
export interface SummarizationRequestedEvent {
  videoId: string;
  style: string;
  provider: string;
  model: string;
  requestedAt: Date;
}

export interface SummarizationCompletedEvent {
  videoId: string;
  style: string;
  provider: string;
  model: string;
  tokenUsage: { input: number; output: number };
  durationMs: number;
  completedAt: Date;
}

export interface SummarizationFailedEvent {
  videoId: string;
  style: string;
  provider: string;
  model: string;
  error: string;
  failedAt: Date;
}

// Cache events
export interface CacheHitEvent {
  key: string;
  type: 'transcript' | 'summary';
  hitAt: Date;
}

export interface CacheMissEvent {
  key: string;
  type: 'transcript' | 'summary';
  missedAt: Date;
}

export interface CacheEvictedEvent {
  key: string;
  reason: 'ttl' | 'size' | 'manual';
  evictedAt: Date;
}

// Rate limit events
export interface RateLimitHitEvent {
  identifier: string;
  limit: number;
  remaining: number;
  resetAt: Date;
}

export interface RateLimitExceededEvent {
  identifier: string;
  limit: number;
  retryAfterMs: number;
  exceededAt: Date;
}

// Error events
export interface ErrorOccurredEvent {
  errorId: string;
  code: string;
  message: string;
  context: Record<string, unknown>;
  occurredAt: Date;
}

// All events map
export interface AppEvents {
  'video:discovered': VideoDiscoveredEvent;
  'video:metadata_fetched': VideoMetadataFetchedEvent;
  'transcript:requested': TranscriptRequestedEvent;
  'transcript:fetched': TranscriptFetchedEvent;
  'transcript:failed': TranscriptFailedEvent;
  'summarization:requested': SummarizationRequestedEvent;
  'summarization:completed': SummarizationCompletedEvent;
  'summarization:failed': SummarizationFailedEvent;
  'cache:hit': CacheHitEvent;
  'cache:miss': CacheMissEvent;
  'cache:evicted': CacheEvictedEvent;
  'rate_limit:hit': RateLimitHitEvent;
  'rate_limit:exceeded': RateLimitExceededEvent;
  'error:occurred': ErrorOccurredEvent;
}