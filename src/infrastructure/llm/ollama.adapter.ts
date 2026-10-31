/**
 * OllamaAdapter - Local Ollama LLM adapter
 * Priority: 3 (tertiary provider - local/private)
 */

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
 * Ollama API response types
 */
interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * OllamaAdapter - Local Ollama implementation
 * Priority: 3 (tertiary - local, free, private)
 */
export class OllamaAdapter implements SummarizerPort {
  readonly name = 'ollama';
  readonly priority = 3;
  readonly provider: LLMProvider = 'ollama';

  private readonly config: SummarizerConfig;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly keepAlive: string;

  constructor(config: SummarizerConfig, baseUrl: string, model?: string, keepAlive?: string) {
    this.config = config;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultModel = model ?? 'llama3.1:8b';
    this.keepAlive = keepAlive ?? '5m';
  }

  async summarize(request: SummaryRequest): Promise<Result<SummaryResult, AppError>> {
    return tryAsync(async () => {
      const { systemPrompt, userPrompt } = this.buildPrompt(request);

      const response = await withTimeout(
        withRetry(
          () => this.callOllamaChat(systemPrompt, userPrompt),
          {
            maxAttempts: this.config.maxRetries + 1,
            baseDelayMs: 3000,
            maxDelayMs: 60000,
            shouldRetry: (error: Error) => this.isRetryableError(error),
          }
        ),
        this.config.timeoutMs,
        new AppError(ErrorCodes.SUMMARIZATION_TIMEOUT, `Ollama request timeout after ${this.config.timeoutMs}ms`)
      );

      const summaryText = response.message?.content?.trim();

      if (!summaryText || summaryText.length === 0) {
        throw new AppError(ErrorCodes.SUMMARIZATION_EMPTY_RESULT, 'Ollama returned empty summary');
      }

      // Estimate token usage (Ollama may not return exact counts)
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

  private async callOllamaChat(systemPrompt: string, userPrompt: string): Promise<OllamaChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens,
        },
        keep_alive: this.keepAlive,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new AppError(
        ErrorCodes.SUMMARIZATION_API_ERROR,
        `Ollama API error: ${response.status} ${response.statusText}`,
        { context: { status: response.status, error: errorText } }
      );
    }

    return response.json() as Promise<OllamaChatResponse>;
  }

  countTokens(text: string): number {
    // Rough estimation: ~4 chars = 1 token for Llama models
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
        const response = await fetch(`${this.baseUrl}/api/tags`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
        });
        return response.ok;
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
      /connection.?refused/i,
      /ECONNREFUSED/,
      /ENOTFOUND/,
      /ETIMEDOUT/,
      /network/i,
      /5\d\d/,
    ];
    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}