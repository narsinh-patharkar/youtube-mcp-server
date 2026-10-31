/**
 * Transcript Mocks - Mock implementations for testing
 */

import type { TranscriptPort, TranscriptResult } from '@domain/transcript/ports.js';
import type { VideoId } from '@domain/video/types.js';
import { vi } from 'vitest';

const DEFAULT_TRANSCRIPT: TranscriptResult = {
  videoId: 'dQw4w9WgXcQ',
  language: 'en',
  segments: [
    { text: 'Welcome to this video', start: 0, duration: 3, language: 'en' },
    { text: 'Today we will learn about TypeScript', start: 3, duration: 5, language: 'en' },
    { text: 'TypeScript is a superset of JavaScript', start: 8, duration: 4, language: 'en' },
    { text: 'It adds static typing', start: 12, duration: 3, language: 'en' },
    { text: 'Let me show you some examples', start: 15, duration: 4, language: 'en' },
  ],
  fullText:
    'Welcome to this video Today we will learn about TypeScript TypeScript is a superset of JavaScript It adds static typing Let me show you some examples',
  fetchedAt: new Date(),
  source: 'youtube-transcript-api',
};

/**
 * Create a mock transcript adapter
 */
export function createMockTranscriptAdapter(
  overrides: Partial<{
    fetch: (videoId: string, language?: string) => Promise<TranscriptResult>;
    getAvailableLanguages: (videoId: string) => Promise<string[]>;
  }> = {}
) {
  return {
    fetch: vi.fn().mockResolvedValue(DEFAULT_TRANSCRIPT),
    getAvailableLanguages: vi.fn().mockResolvedValue(['en', 'es', 'fr', 'de']),
    ...overrides,
  };
}

/**
 * Create a mock that returns different transcripts per video
 */
export function createVideoSpecificTranscriptAdapter(transcripts: Map<string, TranscriptResult>) {
  return {
    fetch: vi.fn().mockImplementation(async (videoId: string, language?: string) => {
      const transcript = transcripts.get(videoId);
      if (!transcript) {
        throw new Error(`Transcript not found for video: ${videoId}`);
      }
      return { ...transcript, language: language ?? transcript.language };
    }),
    getAvailableLanguages: vi.fn().mockImplementation(async (videoId: string) => {
      const transcript = transcripts.get(videoId);
      return transcript ? [transcript.language] : ['en'];
    }),
  };
}

/**
 * Create a mock that fails for specific videos
 */
export function createFailingTranscriptAdapter(
  failingVideoIds: string[],
  error: Error = new Error('Transcript not available')
) {
  return {
    fetch: vi.fn().mockImplementation(async (videoId: string) => {
      if (failingVideoIds.includes(videoId)) {
        throw error;
      }
      return DEFAULT_TRANSCRIPT;
    }),
    getAvailableLanguages: vi.fn().mockResolvedValue(['en']),
  };
}

/**
 * Create a mock with language support
 */
export function createMultiLanguageTranscriptAdapter(
  transcripts: Record<string, TranscriptResult> = {
    en: { ...DEFAULT_TRANSCRIPT, language: 'en' },
    es: {
      ...DEFAULT_TRANSCRIPT,
      language: 'es',
      fullText: 'Bienvenido a este video Hoy aprenderemos sobre TypeScript',
    },
    fr: {
      ...DEFAULT_TRANSCRIPT,
      language: 'fr',
      fullText: "Bienvenue dans cette vidéo Aujourd'hui nous allons apprendre TypeScript",
    },
  }
) {
  return {
    fetch: vi.fn().mockImplementation(async (videoId: string, language: string = 'en') => {
      const transcript = transcripts[language];
      if (!transcript) {
        throw new Error(`Language not available: ${language}`);
      }
      return { ...transcript, videoId };
    }),
    getAvailableLanguages: vi.fn().mockResolvedValue(Object.keys(transcripts)),
  };
}

/**
 * Create a mock that simulates rate limiting
 */
export function createRateLimitedTranscriptAdapter(
  maxRequests: number = 5,
  windowMs: number = 60000
) {
  let requests = 0;
  let windowStart = Date.now();

  return {
    fetch: vi.fn().mockImplementation(async (videoId: string) => {
      const now = Date.now();
      if (now - windowStart > windowMs) {
        requests = 0;
        windowStart = now;
      }

      if (requests >= maxRequests) {
        const retryAfter = windowStart + windowMs - now;
        const error = new Error('Rate limited') as Error & { retryAfter: number; code: string };
        error.code = 'RATE_LIMITED';
        error.retryAfter = retryAfter;
        throw error;
      }

      requests++;
      return { ...DEFAULT_TRANSCRIPT, videoId };
    }),
    getAvailableLanguages: vi.fn().mockResolvedValue(['en']),
  };
}

/**
 * Create a slow transcript adapter
 */
export function createSlowTranscriptAdapter(delayMs: number = 500) {
  const mock = createMockTranscriptAdapter();
  const originalFetch = mock.fetch;

  mock.fetch = vi.fn().mockImplementation(async (...args) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return originalFetch(...args);
  });

  return mock;
}

/**
 * Create a mock that tracks call count
 */
export function createTrackingTranscriptAdapter() {
  const callLog: Array<{ videoId: string; language?: string; timestamp: Date }> = [];

  const mock = createMockTranscriptAdapter({
    fetch: vi.fn().mockImplementation(async (videoId: string, language?: string) => {
      callLog.push({ videoId, language, timestamp: new Date() });
      return DEFAULT_TRANSCRIPT;
    }),
    getCallLog: vi.fn().mockImplementation(() => [...callLog]),
    resetCallLog: vi.fn().mockImplementation(() => {
      callLog.length = 0;
    }),
  });

  return mock;
}
