/**
 * Summary DTOs - Input/Output data transfer objects
 */

import { z } from 'zod';
import { AppError, ErrorCodes } from '@core/errors/index.js';
import { ok, err } from '@core/utils/result.js';
import type { Result } from '@core/utils/result.js';
import { VideoId } from '@domain/transcript/video-id.js';
import type { SummaryStyle } from '@domain/summary/summary-style.js';
import { isValidSummaryStyle, getDefaultSummaryStyle } from '@domain/summary/summary-style.js';
import { Summary } from '@domain/summary/summary.js';
import { Transcript } from '@domain/transcript/transcript.js';

/**
 * Input for getting a summary
 */
export const GetSummaryInputSchema = z.object({
  /** Video ID or URL */
  videoIdOrUrl: z.string().min(1),
  /** Summary style */
  style: z.enum(['concise', 'detailed', 'technical', 'action-items', 'bullet-points']).optional(),
  /** Force refresh (bypass cache) */
  forceRefresh: z.boolean().default(false),
  /** Custom prompt addition */
  customPrompt: z.string().optional(),
  /** Custom system prompt */
  systemPrompt: z.string().optional(),
});

export type GetSummaryInput = z.infer<typeof GetSummaryInputSchema>;

/**
 * Parsed and validated input
 */
export interface ParsedGetSummaryInput {
  videoId: VideoId;
  style?: SummaryStyle;
  forceRefresh: boolean;
  customPrompt?: string;
  systemPrompt?: string;
}

/**
 * Parse and validate GetSummaryInput
 */
export function parseGetSummaryInput(input: GetSummaryInput): Result<ParsedGetSummaryInput, AppError> {
  const result = GetSummaryInputSchema.safeParse(input);
  if (!result.success) {
    return err(new AppError(ErrorCodes.MCP_INVALID_ARGUMENTS, 'Invalid input', {
      context: { issues: result.error.issues },
    }));
  }

  const videoIdResult = VideoId.fromUrlOrId(result.data.videoIdOrUrl);
  if (!videoIdResult.ok) {
    return err(videoIdResult.error);
  }

  let style: SummaryStyle | undefined;
  if (result.data.style) {
    if (!isValidSummaryStyle(result.data.style)) {
      return err(new AppError(ErrorCodes.SUMMARIZATION_FAILED, 'Invalid summary style'));
    }
    style = result.data.style;
  }

  return ok({
    videoId: videoIdResult.value,
    style,
    forceRefresh: result.data.forceRefresh,
    customPrompt: result.data.customPrompt,
    systemPrompt: result.data.systemPrompt,
  });
}

/**
 * Output from getting a summary
 */
export interface GetSummaryOutput {
  /** The summary */
  summary: Summary;
  /** Whether the summary was retrieved from cache */
  fromCache: boolean;
}

/**
 * Summary summary for listings
 */
export interface SummarySummary {
  videoId: string;
  style: string;
  source: string;
  wordCount: number;
  generatedAt: string;
  model: string;
  tokenUsage?: { input: number; output: number; total: number };
}

/**
 * Convert Summary to summary
 */
export function toSummarySummary(summary: Summary): SummarySummary {
  return {
    videoId: summary.videoId.value,
    style: summary.style,
    source: summary.source,
    wordCount: summary.wordCount,
    generatedAt: summary.generatedAt.toISOString(),
    model: summary.model,
    tokenUsage: summary.tokenUsage,
  };
}

/**
 * Available models output
 */
export interface AvailableModelsOutput {
  providers: Array<{
    provider: string;
    model: string;
    supportedStyles: string[];
    healthy: boolean;
  }>;
}