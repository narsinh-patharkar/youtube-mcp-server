/**
 * VideoId Value Object - Validates and normalizes YouTube video IDs and URLs
 */

import { AppError, ErrorCodes } from '@core/errors/index.js';
import type { Result } from '@core/utils/result.js';
import { err, ok } from '@core/utils/result.js';
import { z } from 'zod';

/**
 * Supported YouTube URL patterns
 */
const YOUTUBE_URL_PATTERNS = [
  // Standard watch URL: youtube.com/watch?v=VIDEO_ID
  /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  // Short URL: youtu.be/VIDEO_ID
  /^(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
  // Embed URL: youtube.com/embed/VIDEO_ID
  /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  // Shorts URL: youtube.com/shorts/VIDEO_ID
  /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  // Music URL: music.youtube.com/watch?v=VIDEO_ID
  /^(?:https?:\/\/)?(?:www\.)?music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
] as const;

/**
 * Video ID schema (11 character alphanumeric with hyphens/underscores)
 */
export const VideoIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{11}$/);

/**
 * VideoId value object - represents a validated YouTube video identifier
 */
export class VideoId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  /**
   * Create VideoId from a validated string
   * @internal Use create() or fromUrl() instead
   */
  static createUnsafe(value: string): VideoId {
    return new VideoId(value);
  }

  /**
   * Create VideoId from a raw video ID string
   */
  static create(value: string): Result<VideoId, AppError> {
    const result = VideoIdSchema.safeParse(value);
    if (!result.success) {
      return err(
        new AppError(ErrorCodes.VIDEO_ID_INVALID, 'Invalid video ID format', {
          context: { input: value, issues: result.error.issues },
        })
      );
    }
    return ok(new VideoId(result.data));
  }

  /**
   * Extract and create VideoId from various YouTube URL formats
   */
  static fromUrl(url: string): Result<VideoId, AppError> {
    if (!url || typeof url !== 'string') {
      return err(
        new AppError(ErrorCodes.VIDEO_URL_INVALID, 'URL is required', {
          context: { input: url },
        })
      );
    }

    // Try to extract video ID from URL patterns
    for (const pattern of YOUTUBE_URL_PATTERNS) {
      const match = url.match(pattern);
      if (match?.[1]) {
        return VideoId.create(match[1]);
      }
    }

    // If no URL pattern matched, try as raw ID
    return VideoId.create(url.trim());
  }

  /**
   * Create VideoId from URL or raw ID (alias for fromUrl)
   */
  static fromUrlOrId(input: string): Result<VideoId, AppError> {
    return VideoId.fromUrl(input);
  }

  /**
   * Get the raw video ID value
   */
  get value(): string {
    return this._value;
  }

  /**
   * Get the standard watch URL
   */
  get watchUrl(): string {
    return `https://www.youtube.com/watch?v=${this._value}`;
  }

  /**
   * Get the short URL
   */
  get shortUrl(): string {
    return `https://youtu.be/${this._value}`;
  }

  /**
   * Get the embed URL
   */
  get embedUrl(): string {
    return `https://www.youtube.com/embed/${this._value}`;
  }

  /**
   * Equality check
   */
  equals(other: VideoId): boolean {
    return this._value === other._value;
  }

  /**
   * String representation
   */
  toString(): string {
    return this._value;
  }

  /**
   * JSON serialization
   */
  toJSON(): string {
    return this._value;
  }
}

/**
 * Type guard for VideoId
 */
export function isVideoId(value: unknown): value is VideoId {
  return value instanceof VideoId;
}
