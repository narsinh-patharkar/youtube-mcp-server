/**
 * SummaryService - Orchestrates summarization with transcript extraction, chunking, LLM, and caching
 */

import { AppError, ErrorCodes } from '@core/errors/index.js';
import { ok, err, tryAsync } from '@core/utils/result.js';
import type { Result } from '@core/utils/result.js';
import { EventEmitter } from '@core/events/emitter.js';
import { TranscriptService } from './transcript.service.js';
import { LLMRouter } from '@infrastructure/llm/llm.router.js';
import type { SummarizerPort } from '@domain/summary/ports/summarizer.port.js';
import type { SummaryRepositoryPort } from '@domain/summary/ports/summary-repository.port.js';
import type { SummarizationConfig } from '@config/schema.js';
import { Summary } from '@domain/summary/summary.js';
import { SummaryResult } from '@domain/summary/summary-result.js';
import { VideoId } from '@domain/transcript/video-id.js';
import type { SummaryStyle } from '@domain/summary/summary-style.js';
import { getDefaultSummaryStyle } from '@domain/summary/summary-style.js';
import { SummaryRequest } from '@domain/summary/summary-request.js';
import { ChunkingService } from '@infrastructure/llm/chunking.service.js';
import { Transcript } from '@domain/transcript/transcript.js';

/**
 * SummaryService dependencies
 */
export interface SummaryServiceDeps {
  /** Transcript service for fetching transcripts */
  transcriptService: TranscriptService;
  /** LLM router for summarization */
  llmRouter: SummarizerPort;
  /** Chunking service for long transcripts */
  chunkingService: ChunkingService;
  /** Summary repository (cache) */
  repository: SummaryRepositoryPort;
  /** Configuration */
  config: SummarizationConfig;
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
 * Service for summarization with transcript extraction, chunking, and caching
 */
export class SummaryService {
  private readonly transcriptService: TranscriptService;
  private readonly llmRouter: SummarizerPort;
  private readonly chunkingService: ChunkingService;
  private readonly repository: SummaryRepositoryPort;
  private readonly config: SummarizationConfig;
  private readonly eventEmitter: EventEmitter;
  private readonly logger: SummaryServiceDeps['logger'];

  constructor(deps: SummaryServiceDeps) {
    this.transcriptService = deps.transcriptService;
    this.llmRouter = deps.llmRouter;
    this.chunkingService = deps.chunkingService;
    this.repository = deps.repository;
    this.config = deps.config;
    this.eventEmitter = deps.eventEmitter;
    this.logger = deps.logger;
  }

  /**
   * Get summary with transcript extraction, chunking, LLM, and caching
   */
  async getSummary(
    videoId: VideoId,
    style?: SummaryStyle,
    forceRefresh: boolean = false,
    customPrompt?: string,
    systemPrompt?: string
  ): Promise<Result<{ summary: Summary; fromCache: boolean }, AppError>> {
    const targetStyle = style ?? getDefaultSummaryStyle();

    // Emit event
    this.eventEmitter.emit('summarization:requested', {
      videoId: videoId.value,
      style: targetStyle,
      forceRefresh,
    });

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedResult = await this.repository.get(videoId, targetStyle);
      if (cachedResult.ok && cachedResult.value) {
        this.logger.debug('Summary cache hit', {
          videoId: videoId.value,
          style: targetStyle,
        });
        this.eventEmitter.emit('cache:hit', { key: `summary:${videoId.value}:${targetStyle}` });
        return ok({ summary: cachedResult.value, fromCache: true });
      }
      if (cachedResult.ok) {
        this.eventEmitter.emit('cache:miss', { key: `summary:${videoId.value}:${targetStyle}` });
      }
    }

    // Step 1: Get transcript
    this.logger.debug('Fetching transcript for summarization', {
      videoId: videoId.value,
      style: targetStyle,
    });

    const transcriptResult = await this.transcriptService.getTranscript(videoId);
    if (!transcriptResult.ok) {
      this.logger.error('Failed to get transcript for summarization', {
        videoId: videoId.value,
        error: transcriptResult.error.message,
      });
      this.eventEmitter.emit('summarization:failed', {
        videoId: videoId.value,
        style: targetStyle,
        error: transcriptResult.error.code,
      });
      return err(transcriptResult.error);
    }

    const { transcript, fromCache: transcriptFromCache } = transcriptResult.value;

    // Step 2: Check if chunking is needed
    const chunkingStats = this.chunkingService.getChunkingStats(transcript);
    this.logger.debug('Chunking analysis', {
      videoId: videoId.value,
      ...chunkingStats,
    });

    // Step 3: Generate summary (with or without chunking)
    let summaryResult: Result<{ summary: string; model: string; provider: string; tokenUsage?: { input: number; output: number; total: number } }, AppError>;

    if (chunkingStats.needsChunking) {
      this.logger.info('Transcript exceeds token limit, using chunked summarization', {
        videoId: videoId.value,
        estimatedTokens: chunkingStats.estimatedTokens,
        estimatedChunks: chunkingStats.estimatedChunks,
      });

      summaryResult = await this.chunkingService.summarizeWithChunking(
        transcript,
        this.createSummarizerAdapter(),
        targetStyle
      );
    } else {
      // Direct summarization
      const summaryRequestResult = SummaryRequest.create(
        videoId,
        transcript,
        targetStyle,
        { customPrompt, systemPrompt }
      );
      if (!summaryRequestResult.ok) {
        return err(summaryRequestResult.error);
      }
      summaryResult = await this.llmRouter.summarize(summaryRequestResult.value);
    }

    if (!summaryResult.ok) {
      this.logger.error('Summarization failed', {
        videoId: videoId.value,
        style: targetStyle,
        error: summaryResult.error.message,
      });
      this.eventEmitter.emit('summarization:failed', {
        videoId: videoId.value,
        style: targetStyle,
        error: summaryResult.error.code,
      });
      return err(summaryResult.error);
    }

    // Step 4: Create Summary entity
    const summaryResultData = SummaryResult.create(
      videoId,
      targetStyle,
      summaryResult.value.summary,
      {
        model: summaryResult.value.model,
        provider: summaryResult.value.provider,
        generatedAt: new Date(),
        tokenUsage: summaryResult.value.tokenUsage,
      }
    );
    if (!summaryResultData.ok) {
      return err(summaryResultData.error);
    }

    const summaryEntityResult = Summary.create(
      videoId,
      targetStyle,
      summaryResult.value.provider as Summary['source'],
      summaryResultData.value,
      transcript.id
    );

    if (!summaryEntityResult.ok) {
      return err(summaryEntityResult.error);
    }

    const summary = summaryEntityResult.value;

    // Step 5: Cache the summary
    const cacheResult = await this.repository.set(summary);
    if (!cacheResult.ok) {
      this.logger.warn('Failed to cache summary', {
        videoId: videoId.value,
        style: targetStyle,
        error: cacheResult.error.message,
      });
    }

    this.logger.info('Summary generated successfully', {
      videoId: videoId.value,
      style: targetStyle,
      source: summaryResult.value.provider,
      wordCount: summary.wordCount,
      tokens: summaryResult.value.tokenUsage?.total,
      transcriptFromCache,
    });

    this.eventEmitter.emit('summarization:completed', {
      videoId: videoId.value,
      style: targetStyle,
      source: summaryResult.value.provider,
      wordCount: summary.wordCount,
      transcriptFromCache,
    });

    return ok({ summary, fromCache: false });
  }

  /**
   * Get available models/providers
   */
  async getAvailableModels(): Promise<Result<Array<{
    provider: string;
    model: string;
    supportedStyles: string[];
    healthy: boolean;
  }>, AppError>> {
    // Access the LLMRouter's getPrimaryProvider method via type assertion
    const router = this.llmRouter as any;
    const primaryProvider = router.getPrimaryProvider?.();
    if (primaryProvider) {
      const health = await primaryProvider.isHealthy();
      return ok([{
        provider: primaryProvider.getProvider(),
        model: primaryProvider.getModel(),
        supportedStyles: primaryProvider.getSupportedStyles(),
        healthy: health.ok && health.value,
      }]);
    }
    return ok([]);
  }

  /**
   * Invalidate cache for a video
   */
  async invalidateCache(videoId: VideoId, style?: SummaryStyle): Promise<Result<void, AppError>> {
    if (style) {
      const result = await this.repository.delete(videoId, style);
      if (!result.ok) return err(result.error);
      return ok(undefined);
    }

    this.logger.debug('Summary cache invalidation requested', { videoId: videoId.value });
    return ok(undefined);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<Result<{
    transcriptService: { healthy: boolean };
    llmRouter: { healthy: boolean };
    repository: { healthy: boolean };
  }, AppError>> {
    const [transcriptHealth, llmHealth, repoHealth] = await Promise.all([
      this.transcriptService.healthCheck(),
      this.llmRouter.isHealthy(),
      this.repository.healthCheck(),
    ]);

    return ok({
      transcriptService: transcriptHealth.ok ? { healthy: true } : { healthy: false },
      llmRouter: llmHealth.ok ? { healthy: llmHealth.value } : { healthy: false },
      repository: repoHealth.ok ? { healthy: repoHealth.value.healthy } : { healthy: false },
    });
  }

  /**
   * Create summarizer adapter for chunking service
   */
  private createSummarizerAdapter() {
    return {
      summarize: async (request: {
        videoId: { value: string };
        transcript: Transcript;
        style: SummaryStyle;
        maxLength?: number;
        customPrompt?: string;
        systemPrompt?: string;
      }) => {
        const videoIdResult = VideoId.create(request.videoId.value);
        if (!videoIdResult.ok) {
          return err(videoIdResult.error);
        }
        const summaryRequestResult = SummaryRequest.create(
          videoIdResult.value,
          request.transcript,
          request.style,
          { maxLength: request.maxLength, customPrompt: request.customPrompt, systemPrompt: request.systemPrompt }
        );
        if (!summaryRequestResult.ok) {
          return err(summaryRequestResult.error);
        }
        return this.llmRouter.summarize(summaryRequestResult.value);
      },
    };
  }
}