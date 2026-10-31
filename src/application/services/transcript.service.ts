/**
 * TranscriptService - Orchestrates transcript extraction with fallback and caching
 */

import type { TranscriptConfig } from '@config/schema.js';
import { AppError, ErrorCodes } from '@core/errors/index.js';
import { EventEmitter } from '@core/events/emitter.js';
import type { Result } from '@core/utils/result.js';
import { err, ok } from '@core/utils/result.js';
import { LanguageCode } from '@domain/transcript/language-code.js';
import type { TranscriptExtractorPort } from '@domain/transcript/ports/transcript-extractor.port.js';
import type { TranscriptRepositoryPort } from '@domain/transcript/ports/transcript-repository.port.js';
import { Transcript } from '@domain/transcript/transcript.js';
import { VideoId } from '@domain/transcript/video-id.js';

/**
 * TranscriptService dependencies
 */
export interface TranscriptServiceDeps {
  /** Transcript extractors (ordered by priority) */
  extractors: TranscriptExtractorPort[];
  /** Transcript repository (cache) */
  repository: TranscriptRepositoryPort;
  /** Configuration */
  config: TranscriptConfig;
  /** Event emitter */
  eventEmitter: EventEmitter;
  /** Logger */
  logger: {
    debug: (msg: string, meta?: Record<string, unknown>) => void;
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

/**
 * Service for transcript extraction with fallback chain and caching
 */
export class TranscriptService {
  private readonly extractors: TranscriptExtractorPort[];
  private readonly repository: TranscriptRepositoryPort;
  private readonly config: TranscriptConfig;
  private readonly eventEmitter: EventEmitter;
  private readonly logger: TranscriptServiceDeps['logger'];

  constructor(deps: TranscriptServiceDeps) {
    // Sort extractors by priority (lower = higher priority)
    this.extractors = [...deps.extractors].sort((a, b) => a.priority - b.priority);
    this.repository = deps.repository;
    this.config = deps.config;
    this.eventEmitter = deps.eventEmitter;
    this.logger = deps.logger;
  }

  /**
   * Get transcript with fallback chain and caching
   */
  async getTranscript(
    videoId: VideoId,
    language?: LanguageCode,
    forceRefresh: boolean = false
  ): Promise<Result<{ transcript: Transcript; fromCache: boolean }, AppError>> {
    const targetLang = language ?? LanguageCode.createUnsafe(this.config.defaultLanguage);

    // Emit event
    void this.eventEmitter.emit('transcript:requested', {
      videoId: videoId.value,
      language: targetLang.code,
      forceRefresh,
    });

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedResult = await this.repository.get(videoId, targetLang);
      if (cachedResult.ok && cachedResult.value) {
        this.logger.debug('Transcript cache hit', {
          videoId: videoId.value,
          language: targetLang.code,
        });
        void this.eventEmitter.emit('cache:hit', {
          key: `transcript:${videoId.value}:${targetLang.code}`,
        });
        return ok({ transcript: cachedResult.value, fromCache: true });
      }
      if (cachedResult.ok) {
        void this.eventEmitter.emit('cache:miss', {
          key: `transcript:${videoId.value}:${targetLang.code}`,
        });
      }
    }

    // Try each extractor in priority order
    let lastError: AppError | null = null;

    for (const extractor of this.extractors) {
      this.logger.debug('Trying transcript extractor', {
        videoId: videoId.value,
        language: targetLang.code,
        extractor: extractor.name,
      });

      const result = await extractor.extract(videoId, targetLang);

      if (result.ok) {
        // Success - cache and return
        const transcript = result.value;

        // Cache the transcript
        const cacheResult = await this.repository.set(transcript);
        if (!cacheResult.ok) {
          this.logger.warn('Failed to cache transcript', {
            videoId: videoId.value,
            language: targetLang.code,
            error: cacheResult.error.message,
          });
        }

        this.logger.info('Transcript extracted successfully', {
          videoId: videoId.value,
          language: targetLang.code,
          source: extractor.name,
          segmentCount: transcript.segmentCount,
          duration: transcript.durationFormatted,
        });

        void this.eventEmitter.emit('transcript:fetched', {
          videoId: videoId.value,
          language: targetLang.code,
          source: extractor.name,
          segmentCount: transcript.segmentCount,
        });

        return ok({ transcript, fromCache: false });
      }

      lastError = result.error;
      this.logger.warn('Transcript extractor failed, trying next', {
        videoId: videoId.value,
        language: targetLang.code,
        extractor: extractor.name,
        error: result.error.code,
        message: result.error.message,
      });

      // If it's a client error (e.g., video not found, private), don't try other extractors
      if (result.error.isClientError) {
        break;
      }
    }

    // All extractors failed
    this.logger.error('All transcript extractors failed', {
      videoId: videoId.value,
      language: targetLang.code,
      lastError: lastError?.message,
    });

    const errorCode =
      lastError instanceof AppError ? lastError.code : ErrorCodes.TRANSCRIPT_FETCH_FAILED;
    void this.eventEmitter.emit('transcript:failed', {
      videoId: videoId.value,
      language: targetLang.code,
      error: errorCode,
    });

    return err(
      lastError ??
        new AppError(ErrorCodes.TRANSCRIPT_FETCH_FAILED, 'All transcript extractors failed')
    );
  }

  /**
   * Get available languages for a video
   */
  async getAvailableLanguages(videoId: VideoId): Promise<
    Result<
      Array<{
        code: string;
        name: string;
        isAutoGenerated: boolean;
        isTranslation: boolean;
      }>,
      AppError
    >
  > {
    // Try each extractor until one succeeds
    for (const extractor of this.extractors) {
      const result = await extractor.getAvailableLanguages(videoId);
      if (result.ok && result.value.length > 0) {
        return ok(result.value);
      }
    }

    // Return empty array if no extractor could provide languages
    return ok([]);
  }

  /**
   * Invalidate cache for a video
   */
  async invalidateCache(
    videoId: VideoId,
    language?: LanguageCode
  ): Promise<Result<void, AppError>> {
    const languageCode = language?.code;

    if (language) {
      const result = await this.repository.delete(videoId, language);
      if (!result.ok) return err(result.error);
      return ok(undefined);
    }

    // Delete all languages for this video
    // Note: This requires repository to support pattern deletion
    // For now, we'll just return ok
    this.logger.debug('Cache invalidation requested', {
      videoId: videoId.value,
      language: languageCode,
    });
    return ok(undefined);
  }

  /**
   * Health check all extractors and repository
   */
  async healthCheck(): Promise<
    Result<
      {
        repository: { healthy: boolean; details?: Record<string, unknown> };
        extractors: Array<{ name: string; healthy: boolean }>;
      },
      AppError
    >
  > {
    const [repoHealth, ...extractorHealths] = await Promise.all([
      this.repository.healthCheck(),
      ...this.extractors.map((e) => e.isHealthy()),
    ]);

    return ok({
      repository: repoHealth.ok
        ? repoHealth.value
        : { healthy: false, details: { error: repoHealth.error.message } },
      extractors: this.extractors.map((e, i) => ({
        name: e.name,
        healthy: extractorHealths[i].ok ? extractorHealths[i].value : false,
      })),
    });
  }
}
