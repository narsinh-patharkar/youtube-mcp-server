/**
 * ChunkingService - Map-reduce chunking for long transcripts
 * Splits transcript into chunks, summarizes each, then combines
 */

import { AppError, ErrorCodes } from '@core/errors/index.js';
import { ok, err } from '@core/utils/result.js';
import type { Result } from '@core/utils/result.js';
import { Transcript } from '@domain/transcript/transcript.js';
import type { SummaryStyle } from '@domain/summary/summary-style.js';

/**
 * Chunking configuration
 */
export interface ChunkingConfig {
  maxTranscriptTokens: number;   // Threshold to trigger chunking
  chunkSizeTokens: number;       // Target tokens per chunk
  chunkOverlapTokens: number;    // Overlap between chunks
  enableChunking: boolean;
}

/**
 * Chunk result from map phase
 */
export interface ChunkSummary {
  chunkIndex: number;
  summary: string;
  tokens: number;
  startTime: number;
  endTime: number;
}

/**
 * ChunkingService - Handles map-reduce summarization for long transcripts
 */
export class ChunkingService {
  private readonly config: ChunkingConfig;

  constructor(config: ChunkingConfig) {
    this.config = config;
  }

  /**
   * Check if transcript needs chunking
   */
  needsChunking(transcript: Transcript): boolean {
    if (!this.config.enableChunking) return false;
    const estimatedTokens = this.estimateTokens(transcript.fullText);
    return estimatedTokens > this.config.maxTranscriptTokens;
  }

  /**
   * Split transcript into overlapping chunks
   */
  splitIntoChunks(transcript: Transcript): Transcript[] {
    if (!this.needsChunking(transcript)) {
      return [transcript];
    }

    return transcript.chunkByTokens(
      this.config.chunkSizeTokens,
      this.config.chunkOverlapTokens
    );
  }

  /**
   * Map phase: summarize each chunk in parallel
   */
  async mapChunks(
    chunks: Transcript[],
    summarizer: {
      summarize: (request: {
        videoId: { value: string };
        transcript: Transcript;
        style: SummaryStyle;
        maxLength?: number;
        customPrompt?: string;
        systemPrompt?: string;
      }) => Promise<Result<{ summary: string; model: string; provider: string; tokenUsage?: { input: number; output: number; total: number } }, AppError>>;
    },
    style: SummaryStyle
  ): Promise<Result<ChunkSummary[], AppError>> {
    const results = await Promise.all(
      chunks.map(async (chunk, index) => {
        const request = {
          videoId: { value: chunk.videoId.value },
          transcript: chunk,
          style,
          maxLength: Math.ceil(this.config.chunkSizeTokens * 0.75), // Leave room for combine
        };

        const result = await summarizer.summarize(request);

        if (!result.ok) {
          return err(result.error);
        }

        return ok({
          chunkIndex: index,
          summary: result.value.summary,
          tokens: result.value.tokenUsage?.total ?? this.estimateTokens(result.value.summary),
          startTime: chunk.duration > 0 ? 0 : 0, // Would need segment timing
          endTime: chunk.duration,
        });
      })
    );

    // Check for errors
    for (const result of results) {
      if (!result.ok) {
        return err(result.error);
      }
    }

    return ok(results.map(r => (r as { ok: true; value: ChunkSummary }).value));
  }

  /**
   * Reduce phase: combine chunk summaries into final summary
   */
  async reduceSummaries(
    chunkSummaries: ChunkSummary[],
    summarizer: {
      summarize: (request: {
        videoId: { value: string };
        transcript: Transcript;
        style: SummaryStyle;
        maxLength?: number;
        customPrompt?: string;
        systemPrompt?: string;
      }) => Promise<Result<{ summary: string; model: string; provider: string; tokenUsage?: { input: number; output: number; total: number } }, AppError>>;
    },
    style: SummaryStyle,
    videoId: { value: string }
  ): Promise<Result<{ summary: string; model: string; provider: string; tokenUsage?: { input: number; output: number; total: number } }, AppError>> {
    // Combine chunk summaries
    const combinedText = chunkSummaries
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .map(c => c.summary)
      .join('\n\n---\n\n');

    // Create a temporary transcript-like object for the combined text
    const combinedTranscript = {
      videoId,
      fullText: combinedText,
      wordCount: combinedText.split(/\s+/).filter(w => w.length > 0).length,
    };

    const request = {
      videoId,
      transcript: combinedTranscript as any,
      style,
      maxLength: undefined,
      customPrompt: `Combine these chunk summaries into a coherent final summary. Maintain the ${style} style. Remove redundancy and ensure smooth flow.`,
    };

    return summarizer.summarize(request);
  }

  /**
   * Full map-reduce summarization pipeline
   */
  async summarizeWithChunking(
    transcript: Transcript,
    summarizer: {
      summarize: (request: {
        videoId: { value: string };
        transcript: Transcript;
        style: SummaryStyle;
        maxLength?: number;
        customPrompt?: string;
        systemPrompt?: string;
      }) => Promise<Result<{ summary: string; model: string; provider: string; tokenUsage?: { input: number; output: number; total: number } }, AppError>>;
    },
    style: SummaryStyle
  ): Promise<Result<{ summary: string; model: string; provider: string; tokenUsage?: { input: number; output: number; total: number } }, AppError>> {
    if (!this.needsChunking(transcript)) {
      // No chunking needed, direct summarization
      const request = {
        videoId: { value: transcript.videoId.value },
        transcript,
        style,
      };
      return summarizer.summarize(request);
    }

    // Split into chunks
    const chunks = this.splitIntoChunks(transcript);

    // Map: summarize each chunk
    const mapResult = await this.mapChunks(chunks, summarizer, style);
    if (!mapResult.ok) {
      return err(mapResult.error);
    }

    // Reduce: combine into final summary
    return this.reduceSummaries(mapResult.value, summarizer, style, { value: transcript.videoId.value });
  }

  /**
   * Estimate token count from text
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get chunking statistics for a transcript
   */
  getChunkingStats(transcript: Transcript): {
    needsChunking: boolean;
    estimatedTokens: number;
    estimatedChunks: number;
    chunkSizeTokens: number;
    overlapTokens: number;
  } {
    const estimatedTokens = this.estimateTokens(transcript.fullText);
    const needsChunking = this.needsChunking(transcript);
    const estimatedChunks = needsChunking
      ? Math.ceil(estimatedTokens / (this.config.chunkSizeTokens - this.config.chunkOverlapTokens))
      : 1;

    return {
      needsChunking,
      estimatedTokens,
      estimatedChunks,
      chunkSizeTokens: this.config.chunkSizeTokens,
      overlapTokens: this.config.chunkOverlapTokens,
    };
  }
}