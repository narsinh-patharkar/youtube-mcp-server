/**
 * Summary Entity - Rich domain entity for video summaries
 */

import { generateId } from '@core/utils/crypto.js';
import { AppError, ErrorCodes } from '@core/errors/index.js';
import { ok, err, combine } from '@core/utils/result.js';
import type { Result } from '@core/utils/result.js';
import { VideoId } from '@domain/transcript/video-id.js';
import type { SummaryStyle } from './summary-style.js';
import { isValidSummaryStyle } from './summary-style.js';
import { SummaryResult } from './summary-result.js';
import type { SummaryTimestamp } from './summary-result.js';

/**
 * Summary source types
 */
export type SummarySource = 'claude' | 'openai' | 'ollama' | 'manual';

/**
 * Summary entity - represents a complete video summary
 */
export class Summary {
  private readonly _id: string;
  private readonly _videoId: VideoId;
  private readonly _style: SummaryStyle;
  private readonly _source: SummarySource;
  private readonly _summary: string;
  private readonly _keyPoints: string[];
  private readonly _timestamps: SummaryResult['timestamps'];
  private readonly _generatedAt: Date;
  private readonly _model: string;
  private readonly _tokenUsage?: SummaryResult['tokenUsage'];
  private readonly _transcriptId?: string;

  private constructor(
    id: string,
    videoId: VideoId,
    style: SummaryStyle,
    source: SummarySource,
    summary: string,
    keyPoints: readonly string[],
    timestamps: readonly SummaryTimestamp[],
    generatedAt: Date,
    model: string,
    tokenUsage?: SummaryResult['tokenUsage'],
    transcriptId?: string
  ) {
    this._id = id;
    this._videoId = videoId;
    this._style = style;
    this._source = source;
    this._summary = summary;
    this._keyPoints = [...keyPoints];
    this._timestamps = [...timestamps];
    this._generatedAt = generatedAt;
    this._model = model;
    this._tokenUsage = tokenUsage;
    this._transcriptId = transcriptId;
  }

  static create(
    videoId: VideoId,
    style: SummaryStyle,
    source: SummarySource,
    result: SummaryResult,
    transcriptId?: string
  ): Result<Summary, AppError> {
    if (!isValidSummaryStyle(style)) {
      return err(new AppError(ErrorCodes.SUMMARIZATION_FAILED, 'Invalid summary style'));
    }

    if (!result.summary || result.summary.trim().length === 0) {
      return err(new AppError(ErrorCodes.SUMMARIZATION_EMPTY_RESULT, 'Summary cannot be empty'));
    }

    const id = generateId();

    return ok(new Summary(
      id,
      videoId,
      style,
      source,
      result.summary,
      result.keyPoints,
      result.timestamps,
      result.generatedAt,
      result.model,
      result.tokenUsage,
      transcriptId
    ));
  }

  static reconstruct(data: {
    id: string;
    videoId: string;
    style: string;
    source: SummarySource;
    summary: string;
    keyPoints: string[];
    timestamps: Array<{ time: number; topic: string }>;
    generatedAt: string | Date;
    model: string;
    tokenUsage?: { input: number; output: number; total: number };
    transcriptId?: string;
  }): Result<Summary, AppError> {
    const videoIdResult = VideoId.create(data.videoId);
    if (!videoIdResult.ok) return err(videoIdResult.error);

    const generatedAt = typeof data.generatedAt === 'string' ? new Date(data.generatedAt) : data.generatedAt;

    if (!isValidSummaryStyle(data.style)) {
      return err(new AppError(ErrorCodes.SUMMARIZATION_FAILED, 'Invalid summary style in stored data'));
    }

    return ok(new Summary(
      data.id,
      videoIdResult.value,
      data.style,
      data.source,
      data.summary,
      data.keyPoints,
      data.timestamps,
      generatedAt,
      data.model,
      data.tokenUsage,
      data.transcriptId
    ));
  }

  get id(): string {
    return this._id;
  }

  get videoId(): VideoId {
    return this._videoId;
  }

  get style(): SummaryStyle {
    return this._style;
  }

  get source(): SummarySource {
    return this._source;
  }

  get summary(): string {
    return this._summary;
  }

  get keyPoints(): string[] {
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

  get tokenUsage(): SummaryResult['tokenUsage'] {
    return this._tokenUsage;
  }

  get transcriptId(): string | undefined {
    return this._transcriptId;
  }

  get wordCount(): number {
    return this._summary.split(/\s+/).filter(w => w.length > 0).length;
  }

  get charCount(): number {
    return this._summary.length;
  }

  equals(other: Summary): boolean {
    return this._id === other._id;
  }

  toString(): string {
    return `Summary(videoId: ${this._videoId.value}, style: ${this._style}, source: ${this._source}, words: ${this.wordCount})`;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      videoId: this._videoId.value,
      style: this._style,
      source: this._source,
      summary: this._summary,
      keyPoints: this._keyPoints,
      timestamps: this._timestamps,
      generatedAt: this._generatedAt.toISOString(),
      model: this._model,
      tokenUsage: this._tokenUsage,
      transcriptId: this._transcriptId,
    };
  }
}

export function isSummary(value: unknown): value is Summary {
  return value instanceof Summary;
}