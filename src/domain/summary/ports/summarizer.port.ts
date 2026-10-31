/**
 * SummarizerPort - Interface for LLM-based summarization
 */

import { AppError } from '@core/errors/index.js';
import { ok, err } from '@core/utils/result.js';
import type { Result } from '@core/utils/result.js';
import { SummaryRequest } from '../summary-request.js';
import { SummaryResult } from '../summary-result.js';
import type { SummaryStyle } from '../summary-style.js';

/**
 * LLM Provider types
 */
export type LLMProvider = 'claude' | 'openai' | 'ollama';

/**
 * SummarizerPort interface - implemented by LLM adapters
 */
export interface SummarizerPort {
  /**
   * Provider name
   */
  readonly name: string;

  /**
   * Generate summary from transcript
   */
  summarize(request: SummaryRequest): Promise<Result<SummaryResult, AppError>>;

  /**
   * Count tokens in text (for chunking decisions)
   */
  countTokens(text: string): number;

  /**
   * Get model identifier
   */
  getModel(): string;

  /**
   * Get provider name
   */
  getProvider(): LLMProvider;

  /**
   * Check if provider is available
   */
  isHealthy(): Promise<Result<boolean, AppError>>;

  /**
   * Get supported styles
   */
  getSupportedStyles(): SummaryStyle[];

  /**
   * Provider priority (lower = higher priority, used for fallback chain)
   */
  readonly priority: number;
}

/**
 * Configuration for summarizers
 */
export interface SummarizerConfig {
  timeoutMs: number;
  maxRetries: number;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}