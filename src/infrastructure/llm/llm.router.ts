/**
 * LLMRouter - Provider selection and fallback chain
 * Implements SummarizerPort by routing to providers with fallback
 */

import { AppError, ErrorCodes, isAppError } from '@core/errors/index.js';
import { ok, err, tryAsync } from '@core/utils/result.js';
import type { Result } from '@core/utils/result.js';
import { SummaryRequest } from '@domain/summary/summary-request.js';
import { SummaryResult } from '@domain/summary/summary-result.js';
import type { SummaryStyle } from '@domain/summary/summary-style.js';
import type { SummarizerPort, SummarizerConfig, LLMProvider } from '@domain/summary/ports/summarizer.port.js';

/**
 * LLMRouter - Routes summarization requests to providers with fallback
 * Priority order: 1 (Claude) → 2 (OpenAI) → 3 (Ollama)
 */
export class LLMRouter implements SummarizerPort {
  readonly name = 'llm-router';
  readonly priority = 0; // Highest priority as it handles fallback

  private readonly providers: SummarizerPort[];
  private readonly config: SummarizerConfig;
  private readonly defaultProvider: LLMProvider;

  constructor(
    config: SummarizerConfig,
    providers: SummarizerPort[],
    defaultProvider: LLMProvider = 'claude'
  ) {
    this.config = config;
    this.defaultProvider = defaultProvider;
    // Sort providers by priority (lower = higher priority)
    this.providers = [...providers].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get the primary provider based on config
   */
  getPrimaryProvider(): SummarizerPort | undefined {
    return this.providers.find(p => p.getProvider() === this.defaultProvider);
  }

  /**
   * Get all providers
   */
  getAllProviders(): SummarizerPort[] {
    return [...this.providers];
  }

  async summarize(request: SummaryRequest): Promise<Result<SummaryResult, AppError>> {
    return tryAsync(async () => {
      // Check if specific provider requested in custom prompt or system prompt
      const requestedProvider = this.extractRequestedProvider(request);

      let providersToTry: SummarizerPort[];

      if (requestedProvider) {
        // Try requested provider first, then fallback to others
        const primary = this.providers.find(p => p.getProvider() === requestedProvider);
        const others = this.providers.filter(p => p.getProvider() !== requestedProvider);
        providersToTry = primary ? [primary, ...others] : this.providers;
      } else {
        providersToTry = this.providers;
      }

      let lastError: AppError | null = null;

      for (const provider of providersToTry) {
        // Verify provider is healthy before trying
        const healthCheck = await provider.isHealthy();
        if (!healthCheck.ok || !healthCheck.value) {
          console.warn(`Provider ${provider.getProvider()} health check failed, skipping`);
          continue;
        }

        const result = await provider.summarize(request);

        if (result.ok) {
          return result.value;
        }

        lastError = result.error;

        // If it's a client error (invalid request, auth failure), don't fallback
        if (result.error.isClientError) {
          break;
        }

        // If rate limited or quota exceeded, try next provider
        if (result.error.code === ErrorCodes.LLM_RATE_LIMITED ||
            result.error.code === ErrorCodes.LLM_QUOTA_EXCEEDED) {
          console.warn(`Provider ${provider.getProvider()} rate limited/quota exceeded, trying fallback`);
          continue;
        }

        // For other server errors, try next provider
        if (result.error.isRetryable) {
          console.warn(`Provider ${provider.getProvider()} failed with retryable error, trying fallback: ${result.error.message}`);
          continue;
        }
      }

      // All providers failed
      throw lastError ?? new AppError(ErrorCodes.SUMMARIZATION_PROVIDER_UNAVAILABLE, 'All LLM providers unavailable');
    });
  }

  countTokens(text: string): number {
    // Use the primary provider's tokenizer
    const primary = this.getPrimaryProvider() ?? this.providers[0];
    return primary.countTokens(text);
  }

  getModel(): string {
    const primary = this.getPrimaryProvider() ?? this.providers[0];
    return primary.getModel();
  }

  getProvider(): LLMProvider {
    return this.defaultProvider;
  }

  getSupportedStyles(): SummaryStyle[] {
    // Return intersection of all providers' supported styles
    const allStyles = this.providers.map(p => p.getSupportedStyles());
    return allStyles.reduce((acc, styles) => acc.filter(s => styles.includes(s)), allStyles[0] ?? []);
  }

  async isHealthy(): Promise<Result<boolean, AppError>> {
    return tryAsync(async () => {
      // Healthy if at least one provider is healthy
      const results = await Promise.all(
        this.providers.map(p => p.isHealthy())
      );
      return results.some(r => r.ok && r.value);
    });
  }

  /**
   * Verify all providers are available
   */
  async verifyProviders(): Promise<Result<Record<LLMProvider, boolean>, AppError>> {
    return tryAsync(async () => {
      const results: Record<LLMProvider, boolean> = {
        claude: false,
        openai: false,
        ollama: false,
      };

      await Promise.all(
        this.providers.map(async (provider) => {
          const health = await provider.isHealthy();
          results[provider.getProvider()] = health.ok && health.value;
        })
      );

      return results;
    });
  }

  /**
   * Health check with details per provider
   */
  async healthCheckDetailed(): Promise<Result<{
    healthy: boolean;
    providers: Array<{ name: string; provider: LLMProvider; healthy: boolean; model: string }>;
  }, AppError>> {
    return tryAsync(async () => {
      const providerChecks = await Promise.all(
        this.providers.map(async (p) => {
          const health = await p.isHealthy();
          return {
            name: p.name,
            provider: p.getProvider(),
            healthy: health.ok && health.value,
            model: p.getModel(),
          };
        })
      );

      return {
        healthy: providerChecks.some(p => p.healthy),
        providers: providerChecks,
      };
    });
  }

  private extractRequestedProvider(request: SummaryRequest): LLMProvider | null {
    // Check custom prompt for provider hints
    const customPrompt = (request.customPrompt ?? '').toLowerCase();
    const systemPrompt = (request.systemPrompt ?? '').toLowerCase();

    if (customPrompt.includes('claude') || systemPrompt.includes('claude')) return 'claude';
    if (customPrompt.includes('openai') || systemPrompt.includes('gpt')) return 'openai';
    if (customPrompt.includes('ollama') || systemPrompt.includes('llama') || systemPrompt.includes('local')) return 'ollama';

    return null;
  }
}