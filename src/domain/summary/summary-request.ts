/**
 * SummaryRequest - Input for summarization
 */

import { z } from 'zod';
import { AppError, ErrorCodes } from '@core/errors/index.js';
import { ok, err } from '@core/utils/result.js';
import type { Result } from '@core/utils/result.js';
import { Transcript } from '@domain/transcript/transcript.js';
import { VideoId } from '@domain/transcript/video-id.js';
import type { SummaryStyle } from './summary-style.js';
import { isValidSummaryStyle, SUMMARY_STYLES } from './summary-style.js';

/**
 * Summary request schema
 */
export const SummaryRequestSchema = z.object({
  videoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/),
  transcript: z.custom<Transcript>(),
  style: z.enum(SUMMARY_STYLES),
  maxLength: z.number().int().positive().optional(),
  customPrompt: z.string().optional(),
  systemPrompt: z.string().optional(),
});

/**
 * SummaryRequest value object
 */
export class SummaryRequest {
  private readonly _videoId: VideoId;
  private readonly _transcript: Transcript;
  private readonly _style: SummaryStyle;
  private readonly _maxLength?: number;
  private readonly _customPrompt?: string;
  private readonly _systemPrompt?: string;

  private constructor(
    videoId: VideoId,
    transcript: Transcript,
    style: SummaryStyle,
    maxLength?: number,
    customPrompt?: string,
    systemPrompt?: string
  ) {
    this._videoId = videoId;
    this._transcript = transcript;
    this._style = style;
    this._maxLength = maxLength;
    this._customPrompt = customPrompt;
    this._systemPrompt = systemPrompt;
  }

  static create(
    videoId: VideoId,
    transcript: Transcript,
    style: SummaryStyle = 'detailed',
    options?: {
      maxLength?: number;
      customPrompt?: string;
      systemPrompt?: string;
    }
  ): Result<SummaryRequest, AppError> {
    if (!isValidSummaryStyle(style)) {
      return err(new AppError(ErrorCodes.SUMMARIZATION_FAILED, 'Invalid summary style', {
        context: { style, validStyles: SUMMARY_STYLES },
      }));
    }

    return ok(new SummaryRequest(
      videoId,
      transcript,
      style,
      options?.maxLength,
      options?.customPrompt,
      options?.systemPrompt
    ));
  }

  get videoId(): VideoId {
    return this._videoId;
  }

  get transcript(): Transcript {
    return this._transcript;
  }

  get style(): SummaryStyle {
    return this._style;
  }

  get maxLength(): number | undefined {
    return this._maxLength;
  }

  get customPrompt(): string | undefined {
    return this._customPrompt;
  }

  get systemPrompt(): string | undefined {
    return this._systemPrompt;
  }

  toJSON(): Record<string, unknown> {
    return {
      videoId: this._videoId.value,
      transcript: this._transcript.toJSON(),
      style: this._style,
      maxLength: this._maxLength,
      customPrompt: this._customPrompt,
      systemPrompt: this._systemPrompt,
    };
  }
}