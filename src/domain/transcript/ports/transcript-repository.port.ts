/**
 * TranscriptRepositoryPort - Interface for transcript caching/persistence
 */

import { AppError } from '@core/errors/index.js';
import type { Result } from '@core/utils/result.js';
import { LanguageCode } from '../language-code.js';
import { Transcript } from '../transcript.js';
import { VideoId } from '../video-id.js';

/**
 * Transcript cache key format
 */
export const TRANSCRIPT_CACHE_KEY_PREFIX = 'transcript';

/**
 * Generate cache key for transcript
 */
export function generateTranscriptCacheKey(videoId: VideoId, language: LanguageCode): string {
  return `${TRANSCRIPT_CACHE_KEY_PREFIX}:${videoId.value}:${language.code}`;
}

/**
 * Port interface for transcript repository (cache/persistence)
 * Implementations: SqliteTranscriptRepository, MemoryTranscriptRepository, RedisTranscriptRepository
 */
export interface TranscriptRepositoryPort {
  /**
   * Get transcript from cache
   */
  get(videoId: VideoId, language: LanguageCode): Promise<Result<Transcript | null, AppError>>;

  /**
   * Store transcript in cache
   */
  set(transcript: Transcript, ttlSeconds?: number): Promise<Result<void, AppError>>;

  /**
   * Check if transcript exists in cache
   */
  has(videoId: VideoId, language: LanguageCode): Promise<Result<boolean, AppError>>;

  /**
   * Delete transcript from cache
   */
  delete(videoId: VideoId, language: LanguageCode): Promise<Result<boolean, AppError>>;

  /**
   * Clear all transcripts from cache
   */
  clear(): Promise<Result<void, AppError>>;

  /**
   * Get all cached transcript keys (for maintenance)
   */
  keys(): Promise<Result<string[], AppError>>;

  /**
   * Get cache statistics
   */
  stats(): Promise<Result<{ count: number; sizeBytes: number }, AppError>>;

  /**
   * Health check
   */
  healthCheck(): Promise<Result<{ healthy: boolean; details?: Record<string, unknown> }, AppError>>;
}
