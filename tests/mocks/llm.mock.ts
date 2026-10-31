/**
 * LLM Mocks - Mock implementations for testing
 */

import type { LLMPort, SummarizationRequest, SummarizationResult } from '@domain/summary/ports.js';
import type { SummaryStyle } from '@domain/summary/types.js';

/**
 * Create a mock LLM adapter
 */
export function createMockLLMAdapter(
  overrides: Partial<{
    summarize: (request: SummarizationRequest) => Promise<SummarizationResult>;
    countTokens: (text: string) => number;
    getModel: () => string;
    getProvider: () => string;
  }> = {}
) {
  const defaultResponse: SummarizationResult = {
    summary: 'This is a mocked summary of the video content.',
    keyPoints: ['Mock key point 1', 'Mock key point 2', 'Mock key point 3'],
    timestamps: [
      { time: 0, topic: 'Introduction' },
      { time: 60, topic: 'Main Content' },
      { time: 180, topic: 'Conclusion' },
    ],
    model: 'mock-model',
    provider: 'mock',
    tokenUsage: { input: 1000, output: 200 },
    generatedAt: new Date(),
  };

  return {
    summarize: vi.fn().mockResolvedValue(defaultResponse),
    countTokens: vi.fn().mockImplementation((text: string) => Math.ceil(text.length / 4)),
    getModel: vi.fn().mockReturnValue('mock-model'),
    getProvider: vi.fn().mockReturnValue('mock'),
    ...overrides,
  };
}

/**
 * Create a mock that simulates different responses based on style
 */
export function createStyleAwareMockLLMAdapter() {
  const styleResponses: Record<SummaryStyle, Partial<SummarizationResult>> = {
    concise: {
      summary: 'Concise summary: Video covers main topic in brief.',
      keyPoints: ['Point 1', 'Point 2'],
    },
    detailed: {
      summary: 'Detailed summary: Comprehensive coverage of all topics discussed in the video.',
      keyPoints: ['Detail 1', 'Detail 2', 'Detail 3', 'Detail 4'],
    },
    technical: {
      summary: 'Technical summary: Deep dive into implementation details.',
      keyPoints: ['Technical detail 1', 'Technical detail 2'],
    },
    'action-items': {
      summary: 'Action items: Things to do after watching.',
      keyPoints: ['Action 1', 'Action 2', 'Action 3'],
    },
    'bullet-points': {
      summary: '• Bullet point 1\n• Bullet point 2\n• Bullet point 3',
      keyPoints: ['Bullet 1', 'Bullet 2', 'Bullet 3'],
    },
  };

  return {
    summarize: vi.fn().mockImplementation(async (request: SummarizationRequest) => {
      const styleResponse = styleResponses[request.style] || styleResponses.detailed;
      return {
        ...defaultResponse,
        ...styleResponse,
        style: request.style,
      };
    }),
    countTokens: vi.fn().mockImplementation((text: string) => Math.ceil(text.length / 4)),
    getModel: vi.fn().mockReturnValue('style-aware-mock'),
    getProvider: vi.fn().mockReturnValue('mock'),
  };
}

/**
 * Create a mock that fails
 */
export function createFailingLLMAdapter(error: Error = new Error('LLM API Error')) {
  return {
    summarize: vi.fn().mockRejectedValue(error),
    countTokens: vi.fn().mockImplementation((text: string) => Math.ceil(text.length / 4)),
    getModel: vi.fn().mockReturnValue('failing-mock'),
    getProvider: vi.fn().mockReturnValue('mock'),
  };
}

/**
 * Create a mock with latency simulation
 */
export function createSlowLLMAdapter(delayMs: number = 1000) {
  const mock = createMockLLMAdapter();
  const originalSummarize = mock.summarize;

  mock.summarize = vi.fn().mockImplementation(async (...args) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return originalSummarize(...args);
  });

  return mock;
}

/**
 * Create a mock that tracks token usage
 */
export function createTokenTrackingLLMAdapter() {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const mock = createMockLLMAdapter({
    summarize: vi.fn().mockImplementation(async (request: SummarizationRequest) => {
      const inputTokens = Math.ceil(request.transcript.fullText.length / 4);
      const outputTokens = 200;
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;

      return {
        ...defaultResponse,
        tokenUsage: { input: inputTokens, output: outputTokens },
      };
    }),
    getTokenUsage: vi.fn().mockImplementation(() => ({
      input: totalInputTokens,
      output: totalOutputTokens,
      total: totalInputTokens + totalOutputTokens,
    })),
    resetTokenUsage: vi.fn().mockImplementation(() => {
      totalInputTokens = 0;
      totalOutputTokens = 0;
    }),
  });

  return mock;
}

// Need to import vi
import { vi } from 'vitest';

const defaultResponse: SummarizationResult = {
  summary: 'This is a mocked summary of the video content.',
  keyPoints: ['Mock key point 1', 'Mock key point 2', 'Mock key point 3'],
  timestamps: [
    { time: 0, topic: 'Introduction' },
    { time: 60, topic: 'Main Content' },
    { time: 180, topic: 'Conclusion' },
  ],
  model: 'mock-model',
  provider: 'mock',
  tokenUsage: { input: 1000, output: 200 },
  generatedAt: new Date(),
};
