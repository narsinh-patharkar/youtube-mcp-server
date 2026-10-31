/**
 * MemoryTranscriptRepository - In-memory implementation of transcript cache
 * Suitable for testing and development
 */

import { AppError, ErrorCodes } from '@core/errors/index.js';
import type { Result } from '@core/utils/result.js';
import { err, ok } from '@core/utils/result.js';
import { LanguageCode } from '@domain/transcript/language-code.js';
import type { TranscriptRepositoryPort } from '@domain/transcript/ports/transcript-repository.port.js';
import { Transcript } from '@domain/transcript/transcript.js';
import { VideoId } from '@domain/transcript/video-id.js';

/**
 * Cache entry with expiration
 */
interface CacheEntry {
  transcript: Transcript;
  expiresAt: number;
}

/**
 * In-memory transcript repository
 * Simple Map-based storage with TTL support
 */
export class MemoryTranscriptRepository implements TranscriptRepositoryPort {
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
  private getKey(videoId: VideoId, language: LanguageCode): string {
    return `${videoId.value}:${language.code}`;
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

  /**
   * Get transcript from cache
   */
  async get(
    videoId: VideoId,
    language: LanguageCode
  ): Promise<Result<Transcript | null, AppError>> {
    const key = this.getKey(videoId, language);
    const entry = this.cache.get(key);

    if (!entry) {
      return ok(null);
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return ok(null);
    }

    return ok(entry.transcript);
  }

  /**
   * Store transcript in cache
   */
  async set(transcript: Transcript, ttlSeconds?: number): Promise<Result<void, AppError>> {
    const key = this.getKey(transcript.videoId, transcript.language);
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const expiresAt = Date.now() + ttl * 1000;

    this.cache.set(key, { transcript, expiresAt });
    return ok(undefined);
  }

  /**
   * Check if transcript exists in cache
   */
  async has(videoId: VideoId, language: LanguageCode): Promise<Result<boolean, AppError>> {
    const result = await this.get(videoId, language);
    return ok(result.ok && result.value !== null);
  }

  /**
   * Delete transcript from cache
   */
  async delete(videoId: VideoId, language: LanguageCode): Promise<Result<boolean, AppError>> {
    const key = this.getKey(videoId, language);
    const deleted = this.cache.delete(key);
    return ok(deleted);
  }

  /**
   * Clear all transcripts from cache
   */
  async clear(): Promise<Result<void, AppError>> {
    this.cache.clear();
    return ok(undefined);
  }

  /**
   * Get all cached transcript keys
   */
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

  /**
   * Get cache statistics
   */
  async stats(): Promise<Result<{ count: number; sizeBytes: number }, AppError>> {
    const now = Date.now();
    let count = 0;
    let sizeBytes = 0;

    for (const entry of this.cache.values()) {
      if (entry.expiresAt > now) {
        count++;
        sizeBytes += JSON.stringify(entry.transcript.toJSON()).length;
      }
    }

    return ok({ count, sizeBytes });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<
    Result<{ healthy: boolean; details?: Record<string, unknown> }, AppError>
  > {
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
