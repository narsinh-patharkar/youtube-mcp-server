/**
 * Lifecycle Hooks - Application startup/shutdown management
 */

import type { AppLogger } from '@core/logging/index.js';

export interface LifecycleHook {
  name: string;
  priority?: number; // Lower runs first
  execute: () => Promise<void> | void;
}

export interface ShutdownHook {
  name: string;
  priority?: number; // Higher runs first (reverse order)
  execute: () => Promise<void> | void;
}

export interface HealthCheck {
  name: string;
  check: () => Promise<{ healthy: boolean; details?: Record<string, unknown> }>;
}

export class LifecycleManager {
  private startupHooks: LifecycleHook[] = [];
  private shutdownHooks: ShutdownHook[] = [];
  private healthChecks: HealthCheck[] = [];
  private logger: AppLogger;
  private isShuttingDown = false;
  private isStarted = false;

  constructor(logger: AppLogger) {
    this.logger = logger;
  }

  /**
   * Register a startup hook
   */
  onStartup(hook: LifecycleHook): void {
    this.startupHooks.push(hook);
    this.startupHooks.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  /**
   * Register a shutdown hook
   */
  onShutdown(hook: ShutdownHook): void {
    this.shutdownHooks.push(hook);
    this.shutdownHooks.sort((a, b) => (b.priority ?? 100) - (a.priority ?? 100));
  }

  /**
   * Register a health check
   */
  onHealthCheck(check: HealthCheck): void {
    this.healthChecks.push(check);
  }

  /**
   * Execute all startup hooks
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('LifecycleManager already started');
      return;
    }

    this.logger.info('Starting application', { hookCount: this.startupHooks.length });

    for (const hook of this.startupHooks) {
      const start = process.hrtime.bigint();
      try {
        this.logger.debug(`Executing startup hook: ${hook.name}`);
        await hook.execute();
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        this.logger.debug(`Startup hook completed: ${hook.name}`, { durationMs: Math.round(durationMs) });
      } catch (error) {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        this.logger.error(`Startup hook failed: ${hook.name}`, {
          durationMs: Math.round(durationMs),
          error: error instanceof Error ? error.message : String(error),
        });
        throw new Error(`Startup hook '${hook.name}' failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.isStarted = true;
    this.logger.info('Application started successfully');
  }

  /**
   * Execute all shutdown hooks
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Stopping application', { hookCount: this.shutdownHooks.length });

    const errors: Error[] = [];

    for (const hook of this.shutdownHooks) {
      const start = process.hrtime.bigint();
      try {
        this.logger.debug(`Executing shutdown hook: ${hook.name}`);
        await hook.execute();
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        this.logger.debug(`Shutdown hook completed: ${hook.name}`, { durationMs: Math.round(durationMs) });
      } catch (error) {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(err);
        this.logger.error(`Shutdown hook failed: ${hook.name}`, {
          durationMs: Math.round(durationMs),
          error: err.message,
        });
      }
    }

    this.isStarted = false;

    if (errors.length > 0) {
      const messages = errors.map(e => e.message).join('; ');
      throw new Error(`Shutdown completed with errors: ${messages}`);
    }

    this.logger.info('Application stopped successfully');
  }

  /**
   * Run all health checks
   */
  async checkHealth(): Promise<{ healthy: boolean; checks: Record<string, { healthy: boolean; details?: Record<string, unknown> }> }> {
    const results: Record<string, { healthy: boolean; details?: Record<string, unknown> }> = {};

    for (const check of this.healthChecks) {
      try {
        const result = await check.check();
        results[check.name] = result;
      } catch (error) {
        results[check.name] = {
          healthy: false,
          details: { error: error instanceof Error ? error.message : String(error) },
        };
      }
    }

    const healthy = Object.values(results).every(r => r.healthy);

    return { healthy, checks: results };
  }

  get started(): boolean {
    return this.isStarted;
  }

  get shuttingDown(): boolean {
    return this.isShuttingDown;
  }
}

/**
 * Global lifecycle manager (initialized in bootstrap)
 */
let _lifecycleManager: LifecycleManager | null = null;

export function getLifecycleManager(): LifecycleManager {
  if (!_lifecycleManager) {
    throw new Error('LifecycleManager not initialized. Call initializeLifecycleManager first.');
  }
  return _lifecycleManager;
}

export function initializeLifecycleManager(logger: AppLogger): LifecycleManager {
  _lifecycleManager = new LifecycleManager(logger);
  return _lifecycleManager;
}

export function resetLifecycleManager(): void {
  _lifecycleManager = null;
}