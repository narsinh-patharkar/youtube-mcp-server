/**
 * VideoExtractorPort - Interface for extracting video metadata and ID
 */

import { AppError } from '@core/errors/index.js';
import type { Result } from '@core/utils/result.js';
import { VideoId } from '../video-id.js';

/**
 * Video metadata
 */
export interface VideoMetadata {
  /** Video ID */
  id: VideoId;
  /** Video title */
  title: string;
  /** Channel name */
  channel: string;
  /** Channel ID */
  channelId: string;
  /** Duration in seconds */
  duration: number;
  /** View count */
  viewCount: number;
  /** Upload date */
  uploadedAt: Date;
  /** Description */
  description: string;
  /** Thumbnail URLs */
  thumbnails: {
    default: string;
    medium: string;
    high: string;
    standard?: string;
    maxres?: string;
  };
  /** Tags */
  tags: string[];
  /** Whether video is age-restricted */
  ageRestricted: boolean;
  /** Whether video is private */
  isPrivate: boolean;
  /** Whether video is geo-blocked */
  isGeoBlocked: boolean;
  /** Available languages for transcript */
  availableLanguages: string[];
}

/**
 * Port interface for video metadata extraction
 * Implementations: YouTubeDataApiAdapter, YtDlpAdapter (for metadata)
 */
export interface VideoExtractorPort {
  /**
   * Extract video ID from URL or return as-is if already an ID
   */
  extractVideoId(input: string): Result<VideoId, AppError>;

  /**
   * Get video metadata by ID
   */
  getMetadata(videoId: VideoId): Promise<Result<VideoMetadata, AppError>>;

  /**
   * Search videos by query
   */
  search(query: string, maxResults?: number): Promise<Result<VideoMetadata[], AppError>>;

  /**
   * Check if extractor is available/healthy
   */
  isHealthy(): Promise<Result<boolean, AppError>>;

  /**
   * Get extractor name/identifier
   */
  readonly name: string;
}
