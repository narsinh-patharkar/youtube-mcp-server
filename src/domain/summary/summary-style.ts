/**
 * SummaryStyle - Enumeration of supported summary styles
 */

export type SummaryStyle = 'concise' | 'detailed' | 'technical' | 'action-items' | 'bullet-points';

// Export as const array for Zod validation
export const SUMMARY_STYLES = [
  'concise',
  'detailed',
  'technical',
  'action-items',
  'bullet-points',
] as const;

export type SummaryStyles = typeof SUMMARY_STYLES[number];

export const SummaryStyleLabels: Record<SummaryStyle, string> = {
  concise: 'Concise',
  detailed: 'Detailed',
  technical: 'Technical',
  'action-items': 'Action Items',
  'bullet-points': 'Bullet Points',
} as const;

export const SummaryStyleDescriptions: Record<SummaryStyle, string> = {
  concise: 'Brief 3-5 bullet point summary of key points',
  detailed: 'Comprehensive summary with topics, arguments, and insights',
  technical: 'Focus on technical details: architecture, code patterns, tools',
  'action-items': 'Extract action items, resources, links, and next steps',
  'bullet-points': 'Structured bullet-point summary organized by topic',
} as const;

export function isValidSummaryStyle(value: string): value is SummaryStyle {
  return SUMMARY_STYLES.includes(value as SummaryStyle);
}

export function getDefaultSummaryStyle(): SummaryStyle {
  return 'detailed';
}