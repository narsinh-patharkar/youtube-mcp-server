/**
 * MemorySummaryRepository - In-memory implementation of summary cache
 * Suitable for testing and development
 */

import { AppError, ErrorCodes } from '@core/errors/index.js';
import { ok, err } from '@core/utils/result.js';
import type { Result } from '@core/utils/result.js';
import type { SummaryRepositoryPort } from '@domain/summary/ports/summary-repository.port.js';
import { Summary } from '@domain/summary/summary.js';
import { VideoId } from '@domain/transcript/video-id.js';
import type { SummaryStyle } from '@domain/summary/summary-style.js';
import type { SummaryStyles } from '@domain/summary/summary-style.js';

/**
 * Cache entry with expiration
 */
interface CacheEntry {
  summary: Summary;
  expiresAt: number;
}

/**
 * In-memory summary repository
 * Simple Map-based storage with TTL support
 */
export class MemorySummaryRepository implements SummaryRepositoryPort {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly defaultTtlSeconds: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(defaultTtlSeconds: number = 604800, cleanupIntervalMs: number = 3600000) {
    this.defaultTtlSeconds = defaultTtlSeconds;

    // Start cleanup interval
    if (cleanupIntervalMs > 0) {
      this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
      // Don't prevent process exit
      this.cleanupInterval.unref?.();
    }
  }

  /**
   * Generate cache key
   */
  private getKey(videoId: VideoId, style: SummaryStyle): string {
    return `${videoId.value}:${style}`;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  async get(videoId: VideoId, style: SummaryStyle): Promise<Result<Summary | null, AppError>> {
    const key = this.getKey(videoId, style);
    const entry = this.cache.get(key);

    if (!entry) {
      return ok(null);
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return ok(null);
    }

    return ok(entry.summary);
  }

  async set(summary: Summary, ttlSeconds?: number): Promise<Result<void, AppError>> {
    const key = this.getKey(summary.videoId, summary.style);
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const expiresAt = Date.now() + ttl * 1000;

    this.cache.set(key, { summary, expiresAt });
    return ok(undefined);
  }

  async has(videoId: VideoId, style: SummaryStyle): Promise<Result<boolean, AppError>> {
    const result = await this.get(videoId, style);
    return ok(result.ok && result.value !== null);
  }

  async delete(videoId: VideoId, style: SummaryStyle): Promise<Result<boolean, AppError>> {
    const key = this.getKey(videoId, style);
    const deleted = this.cache.delete(key);
    return ok(deleted);
  }

  async clear(): Promise<Result<void, AppError>> {
    this.cache.clear();
    return ok(undefined);
  }

  async keys(): Promise<Result<string[], AppError>> {
    const now = Date.now();
    const validKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt > now) {
        validKeys.push(key);
      }
    }

    return ok(validKeys);
  }

  async stats(): Promise<Result<{ count: number; sizeBytes: number }, AppError>> {
    const now = Date.now();
    let count = 0;
    let sizeBytes = 0;

    for (const entry of this.cache.values()) {
      if (entry.expiresAt > now) {
        count++;
        sizeBytes += JSON.stringify(entry.summary.toJSON()).length;
      }
    }

    return ok({ count, sizeBytes });
  }

  async healthCheck(): Promise<Result<{ healthy: boolean; details?: Record<string, unknown> }, AppError>> {
    return ok({
      healthy: true,
      details: {
        type: 'memory',
        entries: this.cache.size,
      },
    });
  }

  /**
   * Stop cleanup interval (for testing)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get current cache size (including expired)
   */
  get size(): number {
    return this.cache.size;
  }
}