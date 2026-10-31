/**
 * TranscriptSegment Value Object - Single transcript entry with timing
 */

import { AppError, ErrorCodes } from '@core/errors/index.js';
import type { Result } from '@core/utils/result.js';
import { err, ok } from '@core/utils/result.js';
import { z } from 'zod';

/**
 * Transcript segment schema
 */
export const TranscriptSegmentSchema = z.object({
  text: z.string().min(1),
  start: z.number().int().nonnegative(), // Start time in seconds
  duration: z.number().int().positive(), // Duration in seconds
});

/**
 * TranscriptSegment value object - represents a single transcript entry
 */
export class TranscriptSegment {
  private readonly _text: string;
  private readonly _start: number;
  private readonly _duration: number;

  private constructor(text: string, start: number, duration: number) {
    this._text = text;
    this._start = start;
    this._duration = duration;
  }

  /**
   * Create TranscriptSegment from validated data
   * @internal Use create() instead
   */
  static createUnsafe(text: string, start: number, duration: number): TranscriptSegment {
    return new TranscriptSegment(text, start, duration);
  }

  /**
   * Create TranscriptSegment from raw data
   */
  static create(
    text: string,
    start: number,
    duration: number
  ): Result<TranscriptSegment, AppError> {
    const result = TranscriptSegmentSchema.safeParse({ text, start, duration });
    if (!result.success) {
      return err(
        new AppError(ErrorCodes.TRANSCRIPT_PARSE_FAILED, 'Invalid transcript segment', {
          context: { text, start, duration, issues: result.error.issues },
        })
      );
    }
    return ok(new TranscriptSegment(result.data.text, result.data.start, result.data.duration));
  }

  /**
   * Create from youtube-transcript API response format
   * Response format: { text: string; offset: number; duration: number; lang: string }
   */
  static fromApiResponse(data: {
    text: string;
    offset: number;
    duration: number;
  }): Result<TranscriptSegment, AppError> {
    return TranscriptSegment.create(data.text, Math.floor(data.offset), Math.ceil(data.duration));
  }

  /**
   * Create from yt-dlp JSON response format
   */
  static fromYtDlpResponse(data: {
    text: string;
    start: number;
    duration: number;
  }): Result<TranscriptSegment, AppError> {
    return TranscriptSegment.create(data.text, Math.floor(data.start), Math.ceil(data.duration));
  }

  /**
   * Get the transcript text
   */
  get text(): string {
    return this._text;
  }

  /**
   * Get start time in seconds
   */
  get start(): number {
    return this._start;
  }

  /**
   * Get start time formatted as HH:MM:SS
   */
  get startFormatted(): string {
    return this.formatTime(this._start);
  }

  /**
   * Get duration in seconds
   */
  get duration(): number {
    return this._duration;
  }

  /**
   * Get end time in seconds
   */
  get end(): number {
    return this._start + this._duration;
  }

  /**
   * Get end time formatted as HH:MM:SS
   */
  get endFormatted(): string {
    return this.formatTime(this.end);
  }

  /**
   * Format seconds as HH:MM:SS
   */
  private formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Check if this segment overlaps with another
   */
  overlaps(other: TranscriptSegment): boolean {
    return this._start < other.end && other._start < this.end;
  }

  /**
   * Get time range as string
   */
  get timeRange(): string {
    return `${this.startFormatted} - ${this.endFormatted}`;
  }

  /**
   * Equality check
   */
  equals(other: TranscriptSegment): boolean {
    return (
      this._text === other._text &&
      this._start === other._start &&
      this._duration === other._duration
    );
  }

  /**
   * String representation
   */
  toString(): string {
    return `[${this.timeRange}] ${this._text}`;
  }

  /**
   * JSON serialization
   */
  toJSON(): { text: string; start: number; duration: number } {
    return {
      text: this._text,
      start: this._start,
      duration: this._duration,
    };
  }
}

/**
 * Type guard for TranscriptSegment
 */
export function isTranscriptSegment(value: unknown): value is TranscriptSegment {
  return value instanceof TranscriptSegment;
}
