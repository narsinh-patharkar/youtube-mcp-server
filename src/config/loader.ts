import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppConfigSchema, type AppConfig } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load configuration from multiple sources with precedence:
 * 1. Environment variables (highest)
 * 2. .env file
 * 3. .env.{environment} file
 * 4. .env.local file
 * 5. Defaults (lowest)
 */

interface ConfigSources {
  env: Record<string, string | undefined>;
  dotenv: Record<string, string>;
  dotenvEnv: Record<string, string>;
  dotenvLocal: Record<string, string>;
}

function parseEnvFile(path: string): Record<string, string> {
  try {
    const content = readFileSync(path, 'utf-8');
    const result: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function loadConfigSources(rootDir: string = process.cwd()): ConfigSources {
  const env = process.env;

  // Load .env files in order of precedence
  const dotenv = parseEnvFile(resolve(rootDir, '.env'));
  const dotenvEnv = parseEnvFile(resolve(rootDir, `.env.${env['NODE_ENV'] || 'development'}`));
  const dotenvLocal = parseEnvFile(resolve(rootDir, '.env.local'));

  return { env, dotenv, dotenvEnv, dotenvLocal };
}

function mergeConfigSources(sources: ConfigSources): Record<string, string> {
  const merged: Record<string, string> = {};

  // Lowest precedence first
  for (const [k, v] of Object.entries(sources.dotenv)) merged[k] = v;
  for (const [k, v] of Object.entries(sources.dotenvEnv)) merged[k] = v;
  for (const [k, v] of Object.entries(sources.dotenvLocal)) merged[k] = v;
  for (const [k, v] of Object.entries(sources.env)) {
    if (v !== undefined) merged[k] = v;
  }

  return merged;
}

function transformFlatToNested(flat: Record<string, string>): Record<string, unknown> {
  const nested: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flat)) {
    // Handle nested keys with underscores: TRANSCRIPT_TIMEOUT_MS -> transcript.timeoutMs
    const parts = key.toLowerCase().split('_');
    let current = nested;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part === undefined) continue;
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart === undefined) continue;
    // Convert string values to appropriate types
    current[lastPart] = parseValue(value);
  }

  return nested;
}

function parseValue(value: string): unknown {
  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Number
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d*\.\d+$/.test(value)) return parseFloat(value);

  // Array (comma-separated)
  if (value.includes(',') && !value.includes(':')) {
    return value.split(',').map((v) => v.trim());
  }

  // String (default)
  return value;
}

export function loadConfig(rootDir?: string): AppConfig {
  const sources = loadConfigSources(rootDir);
  const flat = mergeConfigSources(sources);
  const nested = transformFlatToNested(flat);

  // Validate with Zod
  const result = AppConfigSchema.safeParse(nested);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return result.data;
}

export function validateConfig(config: unknown): AppConfig {
  const result = AppConfigSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }
  return result.data;
}

// Export schema for testing
export { AppConfigSchema } from './schema.js';
