/**
 * LanguageCode Value Object Tests
 */

import { AppError, ErrorCodes } from '@core/errors/index.js';
import { LanguageCode } from '@domain/transcript/language-code.js';
import { describe, expect, it } from 'vitest';

describe('LanguageCode', () => {
  describe('create', () => {
    it('should create LanguageCode from valid ISO 639-1 code', () => {
      const result = LanguageCode.create('en');
      expect(result.ok).toBe(true);
      expect(result.value.code).toBe('en');
      expect(result.value.name).toBe('English');
    });

    it('should create LanguageCode from valid extended code', () => {
      const result = LanguageCode.create('zh-Hans');
      expect(result.ok).toBe(true);
      expect(result.value.code).toBe('zh-hans');
      expect(result.value.name).toBe('Chinese (Simplified)');
    });

    it('should normalize to lowercase', () => {
      const result = LanguageCode.create('EN');
      expect(result.ok).toBe(true);
      expect(result.value.code).toBe('en');
    });

    it('should reject invalid format', () => {
      const result = LanguageCode.create('english');
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(ErrorCodes.TRANSCRIPT_LANGUAGE_UNAVAILABLE);
    });

    it('should reject empty string', () => {
      const result = LanguageCode.create('');
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(ErrorCodes.TRANSCRIPT_LANGUAGE_UNAVAILABLE);
    });

    it('should reject non-string input', () => {
      const result = LanguageCode.create(null as any);
      expect(result.ok).toBe(false);
      expect(result.error.code).toBe(ErrorCodes.TRANSCRIPT_LANGUAGE_UNAVAILABLE);
    });
  });

  describe('createOrDefault', () => {
    it('should return created language when valid', () => {
      const lang = LanguageCode.createOrDefault('es');
      expect(lang.code).toBe('es');
      expect(lang.name).toBe('Spanish');
    });

    it('should return default when input is undefined', () => {
      const lang = LanguageCode.createOrDefault(undefined);
      expect(lang.code).toBe('en');
      expect(lang.name).toBe('English');
    });

    it('should return default when input is invalid', () => {
      const lang = LanguageCode.createOrDefault('invalid');
      expect(lang.code).toBe('en');
    });

    it('should use custom default', () => {
      const lang = LanguageCode.createOrDefault(undefined, 'fr');
      expect(lang.code).toBe('fr');
      expect(lang.name).toBe('French');
    });
  });

  describe('properties', () => {
    it('should return base code without region', () => {
      const lang = LanguageCode.createUnsafe('zh-Hans');
      expect(lang.baseCode).toBe('zh');
    });

    it('should return same code for simple codes', () => {
      const lang = LanguageCode.createUnsafe('en');
      expect(lang.baseCode).toBe('en');
    });
  });

  describe('isVariantOf', () => {
    it('should return true for same base language', () => {
      const lang1 = LanguageCode.createUnsafe('zh-Hans');
      const lang2 = LanguageCode.createUnsafe('zh-Hant');
      expect(lang1.isVariantOf(lang2)).toBe(true);
    });

    it('should return false for different base languages', () => {
      const lang1 = LanguageCode.createUnsafe('en');
      const lang2 = LanguageCode.createUnsafe('es');
      expect(lang1.isVariantOf(lang2)).toBe(false);
    });
  });

  describe('equality', () => {
    it('should return true for same code', () => {
      const lang1 = LanguageCode.createUnsafe('en');
      const lang2 = LanguageCode.createUnsafe('en');
      expect(lang1.equals(lang2)).toBe(true);
    });

    it('should return false for different codes', () => {
      const lang1 = LanguageCode.createUnsafe('en');
      const lang2 = LanguageCode.createUnsafe('es');
      expect(lang1.equals(lang2)).toBe(false);
    });
  });

  describe('static helpers', () => {
    it('should return common codes', () => {
      const codes = LanguageCode.getCommonCodes();
      expect(codes).toContain('en');
      expect(codes).toContain('es');
      expect(codes).toContain('zh-Hans');
    });

    it('should identify common languages', () => {
      expect(LanguageCode.isCommon('en')).toBe(true);
      expect(LanguageCode.isCommon('es')).toBe(true);
      expect(LanguageCode.isCommon('xx')).toBe(false);
    });
  });
});
