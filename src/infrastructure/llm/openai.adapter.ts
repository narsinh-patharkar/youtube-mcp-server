/**
 * OpenAIAdapter - OpenAI GPT adapter
 * Priority: 2 (secondary provider)
 */

import OpenAI from 'openai';
import { AppError, ErrorCodes, isAppError } from '@core/errors/index.js';
import { ok, err, tryAsync } from '@core/utils/result.js';
import type { Result } from '@core/utils/result.js';
import { withRetry, withTimeout } from '@core/utils/async.js';
import { SummaryRequest } from '@domain/summary/summary-request.js';
import { SummaryResult } from '@domain/summary/summary-result.js';
import type { SummaryStyle } from '@domain/summary/summary-style.js';
import type { SummaryStyles } from '@domain/summary/summary-style.js';
import type { SummarizerPort, SummarizerConfig, LLMProvider } from '@domain/summary/ports/summarizer.port.js';

/**
 * OpenAIAdapter - OpenAI GPT implementation
 * Priority: 2 (secondary - tried after Claude)
 */
export class OpenAIAdapter implements SummarizerPort {
  readonly name = 'openai';
  readonly priority = 2;
  readonly provider: LLMProvider = 'openai';

  private readonly client: OpenAI;
  private readonly config: SummarizerConfig;
  private readonly defaultModel: string;

  constructor(config: SummarizerConfig, apiKey: string, model?: string, baseUrl?: string, organization?: string) {
    this.config = config;
    this.defaultModel = model ?? 'gpt-4o-mini';
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      organization,
      timeout: config.timeoutMs,
    });
  }

  async summarize(request: SummaryRequest): Promise<Result<SummaryResult, AppError>> {
    return tryAsync(async () => {
      const { systemPrompt, userPrompt } = this.buildPrompt(request);

      const response = await withTimeout(
        withRetry(
          () => this.client.chat.completions.create({
            model: this.defaultModel,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
          {
            maxAttempts: this.config.maxRetries + 1,
            baseDelayMs: 2000,
            maxDelayMs: 30000,
            shouldRetry: (error: Error) => this.isRetryableError(error),
          }
        ),
        this.config.timeoutMs,
        new AppError(ErrorCodes.SUMMARIZATION_TIMEOUT, `OpenAI request timeout after ${this.config.timeoutMs}ms`)
      );

      const summaryText = response.choices[0]?.message?.content?.trim();

      if (!summaryText || summaryText.length === 0) {
        throw new AppError(ErrorCodes.SUMMARIZATION_EMPTY_RESULT, 'OpenAI returned empty summary');
      }

      // Get token usage from response
      const usage = response.usage;
      const inputTokens = usage?.prompt_tokens ?? this.estimateTokens(systemPrompt + userPrompt);
      const outputTokens = usage?.completion_tokens ?? this.estimateTokens(summaryText);

      const result = SummaryResult.create(
        request.videoId,
        request.style,
        summaryText,
        {
          model: this.defaultModel,
          provider: this.provider,
          generatedAt: new Date(),
          tokenUsage: {
            input: inputTokens,
            output: outputTokens,
            total: inputTokens + outputTokens,
          },
        }
      );

      if (!result.ok) {
        throw result.error;
      }

      return result.value;
    });
  }

  countTokens(text: string): number {
    // Rough estimation: ~4 chars = 1 token for GPT
    return Math.ceil(text.length / 4);
  }

  getModel(): string {
    return this.defaultModel;
  }

  getProvider(): LLMProvider {
    return this.provider;
  }

  getSupportedStyles(): SummaryStyle[] {
    return ['concise', 'detailed', 'technical', 'action-items', 'bullet-points'];
  }

  async isHealthy(): Promise<Result<boolean, AppError>> {
    return tryAsync(async () => {
      try {
        await this.client.chat.completions.create({
          model: this.defaultModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        });
        return true;
      } catch {
        return false;
      }
    });
  }

  private buildPrompt(request: SummaryRequest): { systemPrompt: string; userPrompt: string } {
    const templates: Record<SummaryStyle, { systemPrompt: string; userPrompt: (transcript: string, options: { maxLength?: number; customPrompt?: string }) => string }> = {
      concise: {
        systemPrompt: `You are an expert video content summarizer. Create a concise summary in 3-5 bullet points capturing the absolute key points.`,
        userPrompt: (transcript, options) => {
          const maxLen = options?.maxLength ? `\nMaximum length: approximately ${options.maxLength} words.` : '';
          const custom = options?.customPrompt ? `\n\nAdditional instructions: ${options.customPrompt}` : '';
          return `Please provide a concise 3-5 bullet point summary of this transcript:${maxLen}${custom}\n\nTRANSCRIPT:\n${transcript}`;
        },
      },
      detailed: {
        systemPrompt: `You are an expert video content summarizer. Create a comprehensive, well-structured summary with sections: Overview, Key Topics, Important Insights, Actionable Items.`,
        userPrompt: (transcript, options) => {
          const maxLen = options?.maxLength ? `\nTarget length: approximately ${options.maxLength} words.` : '';
          const custom = options?.customPrompt ? `\n\nAdditional instructions: ${options.customPrompt}` : '';
          return `Please provide a detailed, structured summary of this transcript:${maxLen}${custom}\n\nTRANSCRIPT:\n${transcript}`;
        },
      },
      technical: {
        systemPrompt: `You are an expert technical content summarizer. Focus on: architecture decisions, tools/frameworks/libraries, code patterns, algorithms, performance, APIs, protocols, development practices.`,
        userPrompt: (transcript, options) => {
          const maxLen = options?.maxLength ? `\nTarget length: approximately ${options.maxLength} words.` : '';
          const custom = options?.customPrompt ? `\n\nAdditional instructions: ${options.customPrompt}` : '';
          return `Please provide a technical summary of this transcript, focusing on architecture, tools, code patterns, and implementation details:${maxLen}${custom}\n\nTRANSCRIPT:\n${transcript}`;
        },
      },
      'action-items': {
        systemPrompt: `You are an expert at extracting actionable items. Create a checklist with categories: Action Items, Resources & Links, Recommendations, Follow-ups.`,
        userPrompt: (transcript, options) => {
          const maxLen = options?.maxLength ? `\nTarget length: approximately ${options.maxLength} words.` : '';
          const custom = options?.customPrompt ? `\n\nAdditional instructions: ${options.customPrompt}` : '';
          return `Please extract all actionable items from this transcript as a structured checklist:${maxLen}${custom}\n\nTRANSCRIPT:\n${transcript}`;
        },
      },
      'bullet-points': {
        systemPrompt: `You are an expert video content summarizer. Create a structured bullet-point summary organized by topic/theme with hierarchical bullets and clear section headers.`,
        userPrompt: (transcript, options) => {
          const maxLen = options?.maxLength ? `\nTarget length: approximately ${options.maxLength} words.` : '';
          const custom = options?.customPrompt ? `\n\nAdditional instructions: ${options.customPrompt}` : '';
          return `Please provide a structured bullet-point summary organized by topic:${maxLen}${custom}\n\nTRANSCRIPT:\n${transcript}`;
        },
      },
    };

    const template = templates[request.style] ?? templates.detailed;
    return {
      systemPrompt: request.systemPrompt ?? template.systemPrompt,
      userPrompt: template.userPrompt(request.transcript.fullText, {
        maxLength: request.maxLength,
        customPrompt: request.customPrompt,
      }),
    };
  }

  private isRetryableError(error: Error): boolean {
    if (isAppError(error)) {
      return error.isRetryable;
    }
    const retryablePatterns = [
      /timeout/i,
      /rate.?limit/i,
      /429/,
      /5\d\d/,
      /network/i,
      /ECONNREFUSED/,
      /ENOTFOUND/,
      /ETIMEDOUT/,
      /overloaded/i,
    ];
    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}