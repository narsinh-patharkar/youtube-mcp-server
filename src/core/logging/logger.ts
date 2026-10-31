/**
 * Structured Logger - Pino wrapper with application defaults
 */

import type { LoggingConfig } from '@config/schema.js';
import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import { compileRedactionPatterns, createRedactor } from './redact.js';

/**
 * Create a pino logger instance with application defaults
 */
export function createLogger(config: LoggingConfig): Logger {
  const isPretty = config.prettyPrint && process.env['NODE_ENV'] !== 'production';

  const options: LoggerOptions = {
    level: config.level,
    redact: {
      paths: compileRedactionPatterns(config).map((r) => r.source),
      censor: '[REDACTED]',
    },
    base: {
      service: 'youtube-mcp-server',
      pid: process.pid,
      hostname: process.env['HOSTNAME'] ?? 'local',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        ...bindings,
        service: 'youtube-mcp-server',
      }),
    },
  };

  let destination: DestinationStream | undefined;

  if (config.dest === 'stdout') {
    destination = process.stdout;
  } else if (config.dest === 'stderr') {
    destination = process.stderr;
  } else {
    // File destination
    destination = pino.destination({ dest: config.dest, sync: false });
  }

  if (isPretty) {
    // Use pino-pretty for development
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname,service',
          singleLine: false,
        },
      },
    });
  }

  return pino(options, destination);
}

/**
 * Logger interface for type safety
 */
export interface AppLogger {
  trace: (msg: string, meta?: Record<string, unknown>) => void;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  fatal: (msg: string, meta?: Record<string, unknown>) => void;

  child: (bindings: Record<string, unknown>) => AppLogger;
  flush: () => Promise<void>;
}

/**
 * Wrap pino logger to match our interface
 */
export function wrapLogger(pinoLogger: Logger): AppLogger {
  return {
    trace: (msg: string, meta?: Record<string, unknown>) => pinoLogger.trace(meta, msg),
    debug: (msg: string, meta?: Record<string, unknown>) => pinoLogger.debug(meta, msg),
    info: (msg: string, meta?: Record<string, unknown>) => pinoLogger.info(meta, msg),
    warn: (msg: string, meta?: Record<string, unknown>) => pinoLogger.warn(meta, msg),
    error: (msg: string, meta?: Record<string, unknown>) => pinoLogger.error(meta, msg),
    fatal: (msg: string, meta?: Record<string, unknown>) => pinoLogger.fatal(meta, msg),
    child: (bindings: Record<string, unknown>) => wrapLogger(pinoLogger.child(bindings)),
    flush: () =>
      new Promise<void>((resolve) => {
        pinoLogger.flush(() => resolve());
      }),
  };
}

// Global logger instance (initialized in bootstrap)
let _logger: AppLogger | null = null;

export function getLogger(): AppLogger {
  if (!_logger) {
    // Fallback to console if not initialized
    return {
      trace: (...args: unknown[]) => console.debug(...args),
      debug: (...args: unknown[]) => console.debug(...args),
      info: (...args: unknown[]) => console.info(...args),
      warn: (...args: unknown[]) => console.warn(...args),
      error: (...args: unknown[]) => console.error(...args),
      fatal: (...args: unknown[]) => console.error(...args),
      child: () => getLogger(),
      flush: async () => {},
    };
  }
  return _logger;
}

export function setLogger(logger: AppLogger): void {
  _logger = logger;
}

export function initializeLogger(config: LoggingConfig): AppLogger {
  const pinoLogger = createLogger(config);
  const logger = wrapLogger(pinoLogger);
  setLogger(logger);
  return logger;
}
