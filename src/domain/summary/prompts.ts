/**
 * Prompt Templates for Summarization
 * Each style has a system prompt and user prompt template
 */

import type { SummaryStyle } from './summary-style.js';
import { SUMMARY_STYLES } from './summary-style.js';

/**
 * Base system prompt for all summarization
 */
export const BASE_SYSTEM_PROMPT = `You are an expert video content summarizer. Your task is to create clear, accurate, and well-structured summaries of YouTube video transcripts.

Guidelines:
- Be accurate and faithful to the source material
- Do not hallucinate or add information not in the transcript
- Maintain the original tone and intent of the speaker
- Use clear, concise language
- Format output as specified by the style`;

/**
 * Prompt templates for each summary style
 */
export const PROMPT_TEMPLATES: Record<SummaryStyle, {
  systemPrompt: string;
  userPrompt: (transcript: string, options?: { maxLength?: number; customPrompt?: string }) => string;
}> = {
  concise: {
    systemPrompt: `${BASE_SYSTEM_PROMPT}

Create a concise summary in 3-5 bullet points capturing the absolute key points.`,
    userPrompt: (transcript, options) => {
      const maxLength = options?.maxLength ? `\nMaximum length: approximately ${options.maxLength} words.` : '';
      const custom = options?.customPrompt ? `\n\nAdditional instructions: ${options.customPrompt}` : '';
      return `Please provide a concise 3-5 bullet point summary of this transcript:${maxLength}${custom}

TRANSCRIPT:
${transcript}`;
    },
  },

  detailed: {
    systemPrompt: `${BASE_SYSTEM_PROMPT}

Create a comprehensive, well-structured summary with the following sections:
1. **Overview** - Brief 2-3 sentence summary
2. **Key Topics** - Main themes discussed with supporting details
3. **Important Insights** - Notable arguments, conclusions, or takeaways
4. **Actionable Items** (if any) - Resources mentioned, next steps, recommendations

Use clear headings and bullet points for readability.`,
    userPrompt: (transcript, options) => {
      const maxLength = options?.maxLength ? `\nTarget length: approximately ${options.maxLength} words.` : '';
      const custom = options?.customPrompt ? `\n\nAdditional instructions: ${options.customPrompt}` : '';
      return `Please provide a detailed, structured summary of this transcript:${maxLength}${custom}

TRANSCRIPT:
${transcript}`;
    },
  },

  technical: {
    systemPrompt: `${BASE_SYSTEM_PROMPT}

Focus on technical content. Create a summary highlighting:
- Architecture decisions and system design
- Technical tools, frameworks, libraries, and platforms mentioned
- Code patterns, algorithms, or implementation approaches
- Performance considerations, scalability, infrastructure
- APIs, protocols, data formats, integrations
- Development practices, CI/CD, testing, deployment

Organize by technical domain. Use precise terminology.`,
    userPrompt: (transcript, options) => {
      const maxLength = options?.maxLength ? `\nTarget length: approximately ${options.maxLength} words.` : '';
      const custom = options?.customPrompt ? `\n\nAdditional instructions: ${options.customPrompt}` : '';
      return `Please provide a technical summary of this transcript, focusing on architecture, tools, code patterns, and implementation details:${maxLength}${custom}

TRANSCRIPT:
${transcript}`;
    },
  },

  'action-items': {
    systemPrompt: `${BASE_SYSTEM_PROMPT}

Extract ALL actionable items from the transcript. Format as a checklist with these categories:
- **Action Items** - Specific tasks to do
- **Resources & Links** - URLs, tools, documents, products mentioned
- **Recommendations** - Suggestions, best practices, advice given
- **Follow-ups** - Topics to research, people to contact, next steps

If a category has no items, omit it. Be specific and include context.`,
    userPrompt: (transcript, options) => {
      const maxLength = options?.maxLength ? `\nTarget length: approximately ${options.maxLength} words.` : '';
      const custom = options?.customPrompt ? `\n\nAdditional instructions: ${options.customPrompt}` : '';
      return `Please extract all actionable items from this transcript as a structured checklist:${maxLength}${custom}

TRANSCRIPT:
${transcript}`;
    },
  },

  'bullet-points': {
    systemPrompt: `${BASE_SYSTEM_PROMPT}

Create a structured bullet-point summary organized by topic/theme:
- Group related points under clear topic headings
- Use hierarchical bullets (main points → sub-points)
- Include key quotes or statistics where relevant
- Maintain logical flow from start to end of video

Format with clear section headers and consistent indentation.`,
    userPrompt: (transcript, options) => {
      const maxLength = options?.maxLength ? `\nTarget length: approximately ${options.maxLength} words.` : '';
      const custom = options?.customPrompt ? `\n\nAdditional instructions: ${options.customPrompt}` : '';
      return `Please provide a structured bullet-point summary organized by topic:${maxLength}${custom}

TRANSCRIPT:
${transcript}`;
    },
  },
};

/**
 * Get prompt template for a style
 */
export function getPromptTemplate(style: SummaryStyle) {
  return PROMPT_TEMPLATES[style] ?? PROMPT_TEMPLATES.detailed;
}

/**
 * Build full prompt for summarization
 */
export function buildSummarizationPrompt(
  style: SummaryStyle,
  transcript: string,
  options?: {
    maxLength?: number;
    customPrompt?: string;
    systemPrompt?: string;
  }
): { systemPrompt: string; userPrompt: string } {
  const template = getPromptTemplate(style);
  return {
    systemPrompt: options?.systemPrompt ?? template.systemPrompt,
    userPrompt: template.userPrompt(transcript, options),
  };
}

/**
 * Estimate token count (rough: ~4 chars = 1 token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Default configuration for each provider
 */
export const DEFAULT_PROVIDER_CONFIG = {
  claude: {
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 8192,
    temperature: 0.3,
    supportsPromptCaching: true,
  },
  openai: {
    model: 'gpt-4o-mini',
    maxTokens: 4096,
    temperature: 0.3,
    supportsStreaming: true,
  },
  ollama: {
    model: 'llama3.1:8b',
    maxTokens: 4096,
    temperature: 0.3,
    supportsLocal: true,
  },
} as const;