/**
 * Configuration Module - Public API
 */

export * from './schema.js';
export * from './loader.js';
export * from './types.js';

// Lazy-loaded singleton
let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

export function resetConfig(): void {
  _config = null;
}

export function setConfig(config: AppConfig): void {
  _config = config;
}

// Import AppConfig for the function signatures
import type { AppConfig } from './schema.js';
import { loadConfig } from './loader.js';