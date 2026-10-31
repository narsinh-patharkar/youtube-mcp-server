/**
 * GetSummaryUseCase - Application use case for generating summaries
 */

import { AppError } from '@core/errors/index.js';
import { ok, err } from '@core/utils/result.js';
import type { Result } from '@core/utils/result.js';
import { SummaryService } from '../services/summary.service.js';
import { VideoId } from '@domain/transcript/video-id.js';
import type { SummaryStyle } from '@domain/summary/summary-style.js';
import { getDefaultSummaryStyle } from '@domain/summary/summary-style.js';
import type { GetSummaryInput, GetSummaryOutput } from '../dto/summary.dto.js';
import { parseGetSummaryInput } from '../dto/summary.dto.js';

/**
 * GetSummaryUseCase dependencies
 */
export interface GetSummaryUseCaseDeps {
  summaryService: SummaryService;
  logger: {
    debug: (msg: string, meta?: Record<string, unknown>) => void;
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

/**
 * Use case for getting a summary
 * Handles input validation, orchestration, and output formatting
 */
export class GetSummaryUseCase {
  private readonly summaryService: SummaryService;
  private readonly logger: GetSummaryUseCaseDeps['logger'];

  constructor(deps: GetSummaryUseCaseDeps) {
    this.summaryService = deps.summaryService;
    this.logger = deps.logger;
  }

  /**
   * Execute the use case
   */
  async execute(input: GetSummaryInput): Promise<Result<GetSummaryOutput, AppError>> {
    // Parse and validate input
    const parsedResult = parseGetSummaryInput(input);
    if (!parsedResult.ok) {
      return err(parsedResult.error);
    }

    const { videoId, style, forceRefresh, customPrompt, systemPrompt } = parsedResult.value;
    const targetStyle = style ?? getDefaultSummaryStyle();

    this.logger.debug('Executing GetSummaryUseCase', {
      videoId: videoId.value,
      style: targetStyle,
      forceRefresh,
      hasCustomPrompt: !!customPrompt,
      hasSystemPrompt: !!systemPrompt,
    });

    // Delegate to service
    const result = await this.summaryService.getSummary(
      videoId,
      targetStyle,
      forceRefresh,
      customPrompt,
      systemPrompt
    );

    if (!result.ok) {
      this.logger.warn('GetSummaryUseCase failed', {
        videoId: videoId.value,
        style: targetStyle,
        error: result.error.code,
        message: result.error.message,
      });
      return err(result.error);
    }

    this.logger.info('GetSummaryUseCase completed', {
      videoId: videoId.value,
      style: result.value.summary.style,
      fromCache: result.value.fromCache,
      wordCount: result.value.summary.wordCount,
      source: result.value.summary.source,
    });

    return ok({
      summary: result.value.summary,
      fromCache: result.value.fromCache,
    });
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
    return this.summaryService.getAvailableModels();
  }
}