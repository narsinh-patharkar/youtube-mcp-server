/**
 * Test Data Builders - Fluent builders for test fixtures
 */

import type { TranscriptSegment, TranscriptResult, SummaryResult, SummaryStyle } from '@domain/transcript/types.js';
import type { VideoId } from '@domain/video/types.js';
import { ulid } from 'ulid';

/**
 * Build a VideoId
 */
export function aVideoId(overrides: Partial<VideoId> = {}): VideoId {
  const id = overrides.id ?? 'dQw4w9WgXcQ';
  return {
    id,
    url: overrides.url ?? `https://www.youtube.com/watch?v=${id}`,
    ...overrides,
  };
}

/**
 * Build a TranscriptSegment
 */
export function aTranscriptSegment(overrides: Partial<TranscriptSegment> = {}): TranscriptSegment {
  return {
    text: overrides.text ?? 'Hello world',
    start: overrides.start ?? 0,
    duration: overrides.duration ?? 2.5,
    language: overrides.language ?? 'en',
    ...overrides,
  };
}

/**
 * Build a TranscriptResult
 */
export function aTranscriptResult(overrides: Partial<TranscriptResult> = {}): TranscriptResult {
  const segments = overrides.segments ?? [
    aTranscriptSegment({ text: 'Welcome to the video', start: 0, duration: 3 }),
    aTranscriptSegment({ text: 'Today we discuss TypeScript', start: 3, duration: 5 }),
    aTranscriptSegment({ text: 'Let me show you the basics', start: 8, duration: 4 }),
  ];

  const fullText = segments.map(s => s.text).join(' ');

  return {
    videoId: overrides.videoId ?? aVideoId().id,
    language: overrides.language ?? 'en',
    segments,
    fullText,
    fetchedAt: overrides.fetchedAt ?? new Date(),
    source: overrides.source ?? 'youtube-transcript-api',
    ...overrides,
  };
}

/**
 * Build a SummaryResult
 */
export function aSummaryResult(overrides: Partial<SummaryResult> = {}): SummaryResult {
  return {
    videoId: overrides.videoId ?? aVideoId().id,
    style: overrides.style ?? 'detailed',
    summary: overrides.summary ?? 'This video covers TypeScript fundamentals including types, interfaces, and generics.',
    keyPoints: overrides.keyPoints ?? [
      'TypeScript adds static typing to JavaScript',
      'Interfaces define object shapes',
      'Generics enable reusable components',
    ],
    timestamps: overrides.timestamps ?? [
      { time: 3, topic: 'TypeScript Introduction' },
      { time: 45, topic: 'Interfaces Deep Dive' },
      { time: 120, topic: 'Generics Tutorial' },
    ],
    generatedAt: overrides.generatedAt ?? new Date(),
    model: overrides.model ?? 'claude-3-5-sonnet-20241022',
    tokenUsage: overrides.tokenUsage ?? { input: 1500, output: 300 },
    ...overrides,
  };
}

/**
 * Build multiple transcript segments for a longer video
 */
export function buildTranscriptSegments(count: number, baseText: string = 'Segment'): TranscriptSegment[] {
  return Array.from({ length: count }, (_, i) => aTranscriptSegment({
    text: `${baseText} ${i + 1}`,
    start: i * 30,
    duration: 25,
  }));
}

/**
 * Build a long transcript result (for chunking tests)
 */
export function aLongTranscriptResult(segmentCount: number = 500): TranscriptResult {
  const segments = buildTranscriptSegments(segmentCount, 'This is a long transcript segment');
  const fullText = segments.map(s => s.text).join(' ');

  return {
    videoId: aVideoId().id,
    language: 'en',
    segments,
    fullText,
    fetchedAt: new Date(),
    source: 'youtube-transcript-api',
  };
}

/**
 * Build transcript with specific languages
 */
export function aMultiLanguageTranscript(languages: string[] = ['en', 'es', 'fr']): Record<string, TranscriptResult> {
  const result: Record<string, TranscriptResult> = {};
  for (const lang of languages) {
    result[lang] = aTranscriptResult({ language: lang });
  }
  return result;
}

/**
 * Build summary with specific style
 */
export function aStyledSummary(style: SummaryStyle, overrides: Partial<SummaryResult> = {}): SummaryResult {
  const styleContent: Record<SummaryStyle, Partial<SummaryResult>> = {
    concise: {
      summary: 'Video covers TypeScript basics.',
      keyPoints: ['TypeScript adds types to JS', 'Interfaces for object shapes'],
    },
    detailed: {
      summary: 'This comprehensive video covers TypeScript fundamentals...',
      keyPoints: ['Static typing', 'Interfaces', 'Generics', 'Type inference'],
    },
    technical: {
      summary: 'Technical deep-dive into TypeScript type system...',
      keyPoints: ['Type inference algorithms', 'Generic constraints', 'Conditional types'],
    },
    'action-items': {
      summary: 'Action items from the video...',
      keyPoints: ['Install TypeScript', 'Configure tsconfig.json', 'Add type annotations'],
    },
    'bullet-points': {
      summary: '• TypeScript overview\n• Basic types\n• Interfaces\n• Generics',
      keyPoints: ['Overview', 'Types', 'Interfaces', 'Generics'],
    },
  };

  return aSummaryResult({
    style,
    ...styleContent[style],
    ...overrides,
  });
}