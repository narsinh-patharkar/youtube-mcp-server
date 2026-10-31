/**
 * TranscriptSegment Value Object Tests
 */

import { AppError, ErrorCodes } from '@core/errors/index.js';
import { TranscriptSegment } from '@domain/transcript/transcript-segment.js';
import { describe, expect, it } from 'vitest';

describe('TranscriptSegment', () => {
  describe('create', () => {
    it('should create segment from valid data', () => {
      const result = TranscriptSegment.create('Hello world', 0, 5);
      expect(result.ok).toBe(true);
      expect(result.value.text).toBe('Hello world');
      expect(result.value.start).toBe(0);
      expect(result.value.duration).toBe(5);
    });

    it('should reject empty text', () => {
      const result = TranscriptSegment.create('', 0, 5);
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(ErrorCodes.TRANSCRIPT_PARSE_FAILED);
    });

    it('should reject negative start time', () => {
      const result = TranscriptSegment.create('Hello', -1, 5);
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(ErrorCodes.TRANSCRIPT_PARSE_FAILED);
    });

    it('should reject zero duration', () => {
      const result = TranscriptSegment.create('Hello', 0, 0);
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(ErrorCodes.TRANSCRIPT_PARSE_FAILED);
    });

    it('should reject negative duration', () => {
      const result = TranscriptSegment.create('Hello', 0, -1);
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(ErrorCodes.TRANSCRIPT_PARSE_FAILED);
    });
  });

  describe('fromApiResponse', () => {
    it('should create from youtube-transcript API format', () => {
      const result = TranscriptSegment.fromApiResponse({
        text: 'Hello world',
        offset: 0,
        duration: 5.5,
      });
      expect(result.ok).toBe(true);
      expect(result.value.text).toBe('Hello world');
      expect(result.value.start).toBe(0);
      expect(result.value.duration).toBe(6); // ceil(5.5)
    });
  });

  describe('fromYtDlpResponse', () => {
    it('should create from yt-dlp format', () => {
      const result = TranscriptSegment.fromYtDlpResponse({
        text: 'Hello world',
        start: 10.2,
        duration: 3.8,
      });
      expect(result.ok).toBe(true);
      expect(result.value.text).toBe('Hello world');
      expect(result.value.start).toBe(10); // floor(10.2)
      expect(result.value.duration).toBe(4); // ceil(3.8)
    });
  });

  describe('properties', () => {
    const segment = TranscriptSegment.createUnsafe('Hello world', 65, 5); // 1:05

    it('should return correct end time', () => {
      expect(segment.end).toBe(70);
    });

    it('should format start time correctly', () => {
      expect(segment.startFormatted).toBe('01:05');
    });

    it('should format end time correctly', () => {
      expect(segment.endFormatted).toBe('01:10');
    });

    it('should return time range', () => {
      expect(segment.timeRange).toBe('01:05 - 01:10');
    });
  });

  describe('overlaps', () => {
    it('should detect overlapping segments', () => {
      const seg1 = TranscriptSegment.createUnsafe('First', 0, 10);
      const seg2 = TranscriptSegment.createUnsafe('Second', 5, 10);
      expect(seg1.overlaps(seg2)).toBe(true);
      expect(seg2.overlaps(seg1)).toBe(true);
    });

    it('should not detect overlap for adjacent segments', () => {
      const seg1 = TranscriptSegment.createUnsafe('First', 0, 10);
      const seg2 = TranscriptSegment.createUnsafe('Second', 10, 10);
      expect(seg1.overlaps(seg2)).toBe(false);
    });

    it('should not detect overlap for separate segments', () => {
      const seg1 = TranscriptSegment.createUnsafe('First', 0, 5);
      const seg2 = TranscriptSegment.createUnsafe('Second', 20, 5);
      expect(seg1.overlaps(seg2)).toBe(false);
    });
  });

  describe('equality', () => {
    it('should return true for identical segments', () => {
      const seg1 = TranscriptSegment.createUnsafe('Hello', 0, 5);
      const seg2 = TranscriptSegment.createUnsafe('Hello', 0, 5);
      expect(seg1.equals(seg2)).toBe(true);
    });

    it('should return false for different text', () => {
      const seg1 = TranscriptSegment.createUnsafe('Hello', 0, 5);
      const seg2 = TranscriptSegment.createUnsafe('World', 0, 5);
      expect(seg1.equals(seg2)).toBe(false);
    });

    it('should return false for different start time', () => {
      const seg1 = TranscriptSegment.createUnsafe('Hello', 0, 5);
      const seg2 = TranscriptSegment.createUnsafe('Hello', 1, 5);
      expect(seg1.equals(seg2)).toBe(false);
    });

    it('should return false for different duration', () => {
      const seg1 = TranscriptSegment.createUnsafe('Hello', 0, 5);
      const seg2 = TranscriptSegment.createUnsafe('Hello', 0, 6);
      expect(seg1.equals(seg2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return formatted string', () => {
      const segment = TranscriptSegment.createUnsafe('Hello world', 0, 5);
      expect(segment.toString()).toBe('[00:00 - 00:05] Hello world');
    });
  });

  describe('toJSON', () => {
    it('should serialize correctly', () => {
      const segment = TranscriptSegment.createUnsafe('Hello world', 0, 5);
      expect(segment.toJSON()).toEqual({
        text: 'Hello world',
        start: 0,
        duration: 5,
      });
    });
  });
});
