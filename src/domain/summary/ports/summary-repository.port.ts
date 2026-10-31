/**
 * SummaryRepositoryPort - Interface for summary caching/persistence
 */

import { AppError } from '@core/errors/index.js';
import { ok, err } from '@core/utils/result.js';
import type { Result } from '@core/utils/result.js';
import { Summary } from '../summary.js';
import { VideoId } from '@domain/transcript/video-id.js';
import type { SummaryStyle } from '../summary-style.js';

/**
 * Summary cache key prefix
 */
export const SUMMARY_CACHE_KEY_PREFIX = 'summary';

/**
 * Generate cache key for summary
 */
export function generateSummaryCacheKey(videoId: VideoId, style: SummaryStyle): string {
  return `${SUMMARY_CACHE_KEY_PREFIX}:${videoId.value}:${style}`;
}

/**
 * Port interface for summary repository (cache/persistence)
 * Implementations: SqliteSummaryRepository, MemorySummaryRepository, RedisSummaryRepository
 */
export interface SummaryRepositoryPort {
  /**
   * Get summary from cache
   */
  get(videoId: VideoId, style: SummaryStyle): Promise<Result<Summary | null, AppError>>;

  /**
   * Store summary in cache
   */
  set(summary: Summary, ttlSeconds?: number): Promise<Result<void, AppError>>;

  /**
   * Check if summary exists in cache
   */
  has(videoId: VideoId, style: SummaryStyle): Promise<Result<boolean, AppError>>;

  /**
   * Delete summary from cache
   */
  delete(videoId: VideoId, style: SummaryStyle): Promise<Result<boolean, AppError>>;

  /**
   * Clear all summaries from cache
   */
  clear(): Promise<Result<void, AppError>>;

  /**
   * Get all cached summary keys
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