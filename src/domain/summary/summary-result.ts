/**
 * SummaryResult - Output from summarization
 */

import { z } from 'zod';
import { AppError, ErrorCodes } from '@core/errors/index.js';
import { ok, err } from '@core/utils/result.js';
import type { Result } from '@core/utils/result.js';
import { VideoId } from '@domain/transcript/video-id.js';
import type { SummaryStyle } from './summary-style.js';

/**
 * Token usage information
 */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

/**
 * Summary timestamp entry
 */
export interface SummaryTimestamp {
  time: number;
  topic: string;
}

/**
 * SummaryResult value object
 */
export class SummaryResult {
  private readonly _videoId: VideoId;
  private readonly _style: SummaryStyle;
  private readonly _summary: string;
  private readonly _keyPoints: string[];
  private readonly _timestamps: SummaryTimestamp[];
  private readonly _generatedAt: Date;
  private readonly _model: string;
  private readonly _provider: string;
  private readonly _tokenUsage?: TokenUsage;

  private constructor(
    videoId: VideoId,
    style: SummaryStyle,
    summary: string,
    keyPoints: string[],
    timestamps: SummaryTimestamp[],
    generatedAt: Date,
    model: string,
    provider: string,
    tokenUsage?: TokenUsage
  ) {
    this._videoId = videoId;
    this._style = style;
    this._summary = summary;
    this._keyPoints = keyPoints.slice();
    this._timestamps = timestamps.slice();
    this._generatedAt = generatedAt;
    this._model = model;
    this._provider = provider;
    this._tokenUsage = tokenUsage;
  }

  static create(
    videoId: VideoId,
    style: SummaryStyle,
    summary: string,
    options?: {
      keyPoints?: string[];
      timestamps?: SummaryTimestamp[];
      generatedAt?: Date;
      model?: string;
      provider?: string;
      tokenUsage?: TokenUsage;
    }
  ): Result<SummaryResult, AppError> {
    if (!summary || summary.trim().length === 0) {
      return err(new AppError(ErrorCodes.SUMMARIZATION_EMPTY_RESULT, 'Summary cannot be empty'));
    }

    return ok(new SummaryResult(
      videoId,
      style,
      summary.trim(),
      options?.keyPoints ?? [],
      options?.timestamps ?? [],
      options?.generatedAt ?? new Date(),
      options?.model ?? 'unknown',
      options?.provider ?? 'unknown',
      options?.tokenUsage
    ));
  }

  get videoId(): VideoId {
    return this._videoId;
  }

  get style(): SummaryStyle {
    return this._style;
  }

  get summary(): string {
    return this._summary;
  }

  get keyPoints(): readonly string[] {
    return this._keyPoints;
  }

  get timestamps(): readonly SummaryTimestamp[] {
    return this._timestamps;
  }

  get generatedAt(): Date {
    return this._generatedAt;
  }

  get model(): string {
    return this._model;
  }

  get provider(): string {
    return this._provider;
  }

  get tokenUsage(): TokenUsage | undefined {
    return this._tokenUsage;
  }

  get wordCount(): number {
    return this._summary.split(/\s+/).filter(w => w.length > 0).length;
  }

  get charCount(): number {
    return this._summary.length;
  }

  toJSON(): Record<string, unknown> {
    return {
      videoId: this._videoId.value,
      style: this._style,
      summary: this._summary,
      keyPoints: this._keyPoints,
      timestamps: this._timestamps,
      generatedAt: this._generatedAt.toISOString(),
      model: this._model,
      provider: this._provider,
      tokenUsage: this._tokenUsage,
    };
  }
}