/**
 * ClaudeAdapter - Anthropic Claude LLM adapter
 * Priority: 1 (primary provider)
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { AppError, ErrorCodes, isAppError } from '@core/errors/index.js';
import { ok, err, tryAsync } from '@core/utils/result.js';
import type { Result } from '@core/utils/result.js';
import { withRetry, withTimeout } from '@core/utils/async.js';
import { SummaryRequest } from '@domain/summary/summary-request.js';
import { SummaryResult } from '@domain/summary/summary-result.js';
import type { SummaryStyle } from '@domain/summary/summary-style.js';
import { SUMMARY_STYLES } from '@domain/summary/summary-style.js';
import type { SummarizerPort, SummarizerConfig, LLMProvider } from '@domain/summary/ports/summarizer.port.js';

/**
 * ClaudeAdapter - Anthropic Claude implementation
 * Priority: 1 (highest - tried first)
 */
export class ClaudeAdapter implements SummarizerPort {
  readonly name = 'claude';
  readonly priority = 1;
  readonly provider: LLMProvider = 'claude';

  private readonly client: Anthropic;
  private readonly config: SummarizerConfig;
  private readonly defaultModel: string;

  constructor(config: SummarizerConfig, apiKey: string, model?: string) {
    this.config = config;
    this.defaultModel = model ?? 'claude-3-5-sonnet-20241022';
    this.client = new Anthropic({
      apiKey,
      baseURL: config.systemPrompt ? undefined : undefined, // Will use default
      timeout: config.timeoutMs,
    });
  }

  async summarize(request: SummaryRequest): Promise<Result<SummaryResult, AppError>> {
    return tryAsync(async () => {
      const { systemPrompt, userPrompt } = this.buildPrompt(request);

      const response = await withTimeout(
        withRetry(
          () => this.client.messages.create({
            model: this.defaultModel,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: userPrompt,
              },
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
        new AppError(ErrorCodes.SUMMARIZATION_TIMEOUT, `Claude request timeout after ${this.config.timeoutMs}ms`)
      );

      const summaryText = response.content
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      if (!summaryText || summaryText.trim().length === 0) {
        throw new AppError(ErrorCodes.SUMMARIZATION_EMPTY_RESULT, 'Claude returned empty summary');
      }

      // Estimate token usage (Anthropic doesn't always return exact counts)
      const inputTokens = this.estimateTokens(systemPrompt + userPrompt);
      const outputTokens = this.estimateTokens(summaryText);

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
    // Rough estimation: ~4 chars = 1 token for Claude
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
        await this.client.messages.create({
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
    const { systemPrompt, userPrompt } = this.getPromptTemplate(request.style);

    const customSystem = request.systemPrompt ?? systemPrompt;
    const customUser = userPrompt(request.transcript.fullText, {
      maxLength: request.maxLength,
      customPrompt: request.customPrompt,
    });

    return { systemPrompt: customSystem, userPrompt: customUser };
  }

  private getPromptTemplate(style: SummaryStyle) {
    const templates: Record<string, { systemPrompt: string; userPrompt: (transcript: string, options: { maxLength?: number; customPrompt?: string }) => string }> = {
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

    return templates[style] ?? templates.detailed;
  }

  private supportsPromptCaching(): boolean {
    // Check if model supports prompt caching (Claude 3.5+)
    return this.defaultModel.includes('claude-3-5') || this.defaultModel.includes('claude-3.7');
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