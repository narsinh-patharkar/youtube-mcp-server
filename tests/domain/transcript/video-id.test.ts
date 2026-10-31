/**
 * VideoId Value Object Tests
 */

import { AppError, ErrorCodes } from '@core/errors/index.js';
import { VideoId } from '@domain/transcript/video-id.js';
import { describe, expect, it } from 'vitest';

describe('VideoId', () => {
  describe('create', () => {
    it('should create VideoId from valid 11-char ID', () => {
      const result = VideoId.create('dQw4w9WgXcQ');
      expect(result.ok).toBe(true);
      expect(result.value.value).toBe('dQw4w9WgXcQ');
    });

    it('should reject invalid video ID (too short)', () => {
      const result = VideoId.create('short');
      expect(result.ok).toBe(false);
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error.code).toBe(ErrorCodes.VIDEO_ID_INVALID);
    });

    it('should reject invalid video ID (too long)', () => {
      const result = VideoId.create('thisiswaytoolong');
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(ErrorCodes.VIDEO_ID_INVALID);
    });

    it('should reject invalid characters', () => {
      const result = VideoId.create('invalid@id!');
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(ErrorCodes.VIDEO_ID_INVALID);
    });
  });

  describe('fromUrl', () => {
    it('should extract ID from standard watch URL', () => {
      const result = VideoId.fromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result.ok).toBe(true);
      expect(result.value.value).toBe('dQw4w9WgXcQ');
    });

    it('should extract ID from short URL', () => {
      const result = VideoId.fromUrl('https://youtu.be/dQw4w9WgXcQ');
      expect(result.ok).toBe(true);
      expect(result.value.value).toBe('dQw4w9WgXcQ');
    });

    it('should extract ID from embed URL', () => {
      const result = VideoId.fromUrl('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(result.ok).toBe(true);
      expect(result.value.value).toBe('dQw4w9WgXcQ');
    });

    it('should extract ID from shorts URL', () => {
      const result = VideoId.fromUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
      expect(result.ok).toBe(true);
      expect(result.value.value).toBe('dQw4w9WgXcQ');
    });

    it('should extract ID from music URL', () => {
      const result = VideoId.fromUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result.ok).toBe(true);
      expect(result.value.value).toBe('dQw4w9WgXcQ');
    });

    it('should handle URL without protocol', () => {
      const result = VideoId.fromUrl('www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result.ok).toBe(true);
      expect(result.value.value).toBe('dQw4w9WgXcQ');
    });

    it('should accept raw ID as input', () => {
      const result = VideoId.fromUrl('dQw4w9WgXcQ');
      expect(result.ok).toBe(true);
      expect(result.value.value).toBe('dQw4w9WgXcQ');
    });

    it('should reject empty string', () => {
      const result = VideoId.fromUrl('');
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(ErrorCodes.VIDEO_URL_INVALID);
    });

    it('should reject non-string input', () => {
      const result = VideoId.fromUrl(null as any);
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(ErrorCodes.VIDEO_URL_INVALID);
    });
  });

  describe('URL getters', () => {
    it('should generate correct watch URL', () => {
      const videoId = VideoId.createUnsafe('dQw4w9WgXcQ');
      expect(videoId.watchUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should generate correct short URL', () => {
      const videoId = VideoId.createUnsafe('dQw4w9WgXcQ');
      expect(videoId.shortUrl).toBe('https://youtu.be/dQw4w9WgXcQ');
    });

    it('should generate correct embed URL', () => {
      const videoId = VideoId.createUnsafe('dQw4w9WgXcQ');
      expect(videoId.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });
  });

  describe('equality', () => {
    it('should return true for same video ID', () => {
      const id1 = VideoId.createUnsafe('dQw4w9WgXcQ');
      const id2 = VideoId.createUnsafe('dQw4w9WgXcQ');
      expect(id1.equals(id2)).toBe(true);
    });

    it('should return false for different video IDs', () => {
      const id1 = VideoId.createUnsafe('dQw4w9WgXcQ');
      const id2 = VideoId.createUnsafe('differentID12');
      expect(id1.equals(id2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the raw ID', () => {
      const videoId = VideoId.createUnsafe('dQw4w9WgXcQ');
      expect(videoId.toString()).toBe('dQw4w9WgXcQ');
    });
  });
});
