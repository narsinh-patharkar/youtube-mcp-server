/**
 * Crypto Utilities - Hashing, ID generation, and secure random
 */

import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { ulid } from 'ulid';

/**
 * Generate a ULID (Universally Unique Lexicographically Sortable Identifier)
 * Better than UUID for database indexes and sorting
 */
export function generateId(): string {
  return ulid();
}

/**
 * Generate a UUID v4
 */
export function generateUuid(): string {
  return randomUUID();
}

/**
 * Generate a secure random string
 */
export function generateRandomString(
  length: number = 32,
  charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

/**
 * Generate a secure random token (URL-safe base64)
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

/**
 * Hash a string with SHA-256
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Hash a string with SHA-512
 */
export function sha512(input: string): string {
  return createHash('sha512').update(input).digest('hex');
}

/**
 * Create HMAC-SHA256 signature
 */
export function hmacSha256(key: string, message: string): string {
  const hmac = createHmac('sha256', key);
  hmac.update(message);
  return hmac.digest('hex');
}

/**
 * Constant-time string comparison (prevent timing attacks)
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate a content hash for caching
 */
export function contentHash(...parts: (string | number | boolean | null | undefined)[]): string {
  const input = parts.filter((p) => p !== null && p !== undefined).join('|');
  return sha256(input).slice(0, 16);
}

/**
 * Generate a cache key with prefix
 */
export function cacheKey(
  prefix: string,
  ...parts: (string | number | boolean | null | undefined)[]
): string {
  return `${prefix}${contentHash(...parts)}`;
}

/**
 * Verify HMAC signature
 */
export function verifyHmacSha256(key: string, message: string, signature: string): boolean {
  const expected = hmacSha256(key, message);
  return constantTimeEqual(expected, signature);
}

/**
 * Simple checksum for data integrity
 */
export function checksum(data: string | Uint8Array): string {
  const hash = createHash('md5');
  if (typeof data === 'string') {
    hash.update(data);
  } else {
    hash.update(data);
  }
  return hash.digest('hex').slice(0, 8);
}

/**
 * Generate API key with prefix
 */
export function generateApiKey(prefix: string = 'ytmcp'): string {
  const token = generateToken(24);
  return `${prefix}_${token}`;
}

/**
 * Parse API key
 */
export function parseApiKey(apiKey: string): { prefix: string; token: string } | null {
  const parts = apiKey.split('_');
  if (parts.length !== 2) return null;
  const prefix = parts[0];
  const token = parts[1];
  if (!prefix || !token) return null;
  return { prefix, token };
}
