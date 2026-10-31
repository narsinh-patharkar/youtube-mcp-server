/**
 * LanguageCode Value Object - Validates ISO 639-1 language codes
 */

import { AppError, ErrorCodes } from '@core/errors/index.js';
import type { Result } from '@core/utils/result.js';
import { err, ok } from '@core/utils/result.js';
import { z } from 'zod';

/**
 * Common language codes for YouTube transcripts
 */
export const COMMON_LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  'zh-Hans': 'Chinese (Simplified)',
  'zh-Hant': 'Chinese (Traditional)',
  ar: 'Arabic',
  hi: 'Hindi',
  tr: 'Turkish',
  pl: 'Polish',
  nl: 'Dutch',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  fi: 'Finnish',
  cs: 'Czech',
  hu: 'Hungarian',
  ro: 'Romanian',
  el: 'Greek',
  he: 'Hebrew',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ms: 'Malay',
  tl: 'Filipino',
} as const;

/**
 * Language code schema - ISO 639-1 (2 letters) or extended (e.g., zh-Hans)
 */
export const LanguageCodeSchema = z.string().regex(/^[a-z]{2}(-[A-Z]{2,4})?$/i);

/**
 * LanguageCode value object - represents a validated language code
 */
export class LanguageCode {
  private readonly _code: string;
  private readonly _name: string;

  private constructor(code: string, name?: string) {
    this._code = code.toLowerCase();
    // Case-insensitive lookup for language name
    const nameKey = Object.keys(COMMON_LANGUAGES).find((k) => k.toLowerCase() === this._code);
    this._name =
      name ??
      (nameKey ? COMMON_LANGUAGES[nameKey as keyof typeof COMMON_LANGUAGES] : undefined) ??
      'Unknown';
  }

  /**
   * Create LanguageCode from a validated string
   * @internal Use create() instead
   */
  static createUnsafe(code: string, name?: string): LanguageCode {
    return new LanguageCode(code, name);
  }

  /**
   * Create LanguageCode from a raw language code string
   */
  static create(code: string): Result<LanguageCode, AppError> {
    if (!code || typeof code !== 'string') {
      return err(
        new AppError(ErrorCodes.TRANSCRIPT_LANGUAGE_UNAVAILABLE, 'Language code is required')
      );
    }

    const normalized = code.trim().toLowerCase();
    const result = LanguageCodeSchema.safeParse(normalized);

    if (!result.success) {
      return err(
        new AppError(ErrorCodes.TRANSCRIPT_LANGUAGE_UNAVAILABLE, 'Invalid language code format', {
          context: { input: code, expectedFormat: 'ISO 639-1 (e.g., en, es, zh-Hans)' },
        })
      );
    }

    return ok(new LanguageCode(result.data));
  }

  /**
   * Create LanguageCode with fallback to default
   */
  static createOrDefault(code: string | undefined, defaultCode: string = 'en'): LanguageCode {
    if (!code) {
      return LanguageCode.createUnsafe(defaultCode);
    }
    const result = LanguageCode.create(code);
    return result.ok ? result.value : LanguageCode.createUnsafe(defaultCode);
  }

  /**
   * Get the normalized language code (e.g., 'en', 'zh-hans')
   */
  get code(): string {
    return this._code;
  }

  /**
   * Get the human-readable language name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Get the base language (without region variant)
   * e.g., 'zh-hans' -> 'zh'
   */
  get baseCode(): string {
    return this._code.split('-')[0];
  }

  /**
   * Check if this language is a variant of another
   */
  isVariantOf(other: LanguageCode): boolean {
    return this.baseCode === other.baseCode;
  }

  /**
   * Equality check
   */
  equals(other: LanguageCode): boolean {
    return this._code === other._code;
  }

  /**
   * String representation
   */
  toString(): string {
    return this._code;
  }

  /**
   * JSON serialization
   */
  toJSON(): string {
    return this._code;
  }

  /**
   * Get all common language codes
   */
  static getCommonCodes(): readonly string[] {
    return Object.keys(COMMON_LANGUAGES) as readonly string[];
  }

  /**
   * Check if a code is in common languages
   */
  static isCommon(code: string): boolean {
    return code.toLowerCase() in COMMON_LANGUAGES;
  }
}

/**
 * Type guard for LanguageCode
 */
export function isLanguageCode(value: unknown): value is LanguageCode {
  return value instanceof LanguageCode;
}
