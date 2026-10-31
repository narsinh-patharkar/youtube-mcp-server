/**
 * PII Redaction - Protect sensitive data in logs
 */

import type { LoggingConfig } from '@config/schema.js';

/**
 * Default paths to redact (matches config default)
 */
const DEFAULT_REDACT_PATHS = [
  '*.apiKey',
  '*.apikey',
  '*.api_key',
  '*.accessToken',
  '*.access_token',
  '*.refreshToken',
  '*.refresh_token',
  '*.authorization',
  '*.auth',
  '*.password',
  '*.secret',
  '*.token',
  '*.key',
  '*.cookie',
  '*.set-cookie',
  '*.cookie2',
  '*.x-api-key',
  '*.x-forwarded-for',
];

/**
 * Compile redaction patterns from config
 */
export function compileRedactionPatterns(config: LoggingConfig): RegExp[] {
  const paths = config.redactPaths?.length ? config.redactPaths : DEFAULT_REDACT_PATHS;

  return paths.map((pattern) => {
    // Convert glob-like pattern to regex
    // * matches any characters except .
    // ** matches any characters including .
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^.]*');

    return new RegExp(`^${regexPattern}$`, 'i');
  });
}

/**
 * Redact sensitive values from an object
 */
export function redactObject(obj: unknown, patterns: RegExp[]): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, patterns));
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const shouldRedact = patterns.some((pattern) => pattern.test(key));

    if (shouldRedact) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactObject(value, patterns);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Create a redaction function for a specific config
 */
export function createRedactor(config: LoggingConfig) {
  const patterns = compileRedactionPatterns(config);
  return (obj: unknown) => redactObject(obj, patterns);
}

/**
 * Redact sensitive data from log context
 */
export function redactContext(
  context: Record<string, unknown>,
  config: LoggingConfig
): Record<string, unknown> {
  const redactor = createRedactor(config);
  return redactor(context) as Record<string, unknown>;
}
