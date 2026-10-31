/**
 * SqliteSummaryRepository - SQLite implementation of summary cache
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppError, ErrorCodes } from '@core/errors/index.js';
import { ok, err } from '@core/utils/result.js';
import type { Result } from '@core/utils/result.js';
import type { SummaryRepositoryPort } from '@domain/summary/ports/summary-repository.port.js';
import { Summary } from '@domain/summary/summary.js';
import { VideoId } from '@domain/transcript/video-id.js';
import type { SummaryStyle } from '@domain/summary/summary-style.js';
import type { SummaryStyles } from '@domain/summary/summary-style.js';
import type { CacheConfig } from '@config/schema.js';

/**
 * SQLite summary repository
 * Stores summaries with TTL-based expiration
 */
export class SqliteSummaryRepository implements SummaryRepositoryPort {
  private db: Database.Database | null = null;
  private readonly config: CacheConfig;
  private readonly logger: { debug: (msg: string, meta?: Record<string, unknown>) => void; error: (msg: string, meta?: Record<string, unknown>) => void };

  constructor(config: CacheConfig, logger: { debug: (msg: string, meta?: Record<string, unknown>) => void; error: (msg: string, meta?: Record<string, unknown>) => void }) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize database connection and schema
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    const dbPath = resolve(this.config.sqlitePath);
    mkdirSync(dirname(dbPath), { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');

    // Create summaries table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS summaries (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        style TEXT NOT NULL,
        source TEXT NOT NULL,
        summary TEXT NOT NULL,
        key_points TEXT NOT NULL,
        timestamps TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        model TEXT NOT NULL,
        token_usage TEXT,
        transcript_id TEXT,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_summaries_video_style ON summaries(video_id, style);
      CREATE INDEX IF NOT EXISTS idx_summaries_expires ON summaries(expires_at);
    `);

    if (this.config.vacuumOnStartup) {
      this.db.exec('VACUUM');
    }

    this.logger.debug('SQLite summary repository initialized', { path: dbPath });

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.logger.debug('SQLite summary repository closed');
    }
  }

  private ensureDb(): Database.Database {
    if (!this.db) {
      throw new AppError(ErrorCodes.CACHE_CONNECTION_FAILED, 'Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  async get(videoId: VideoId, style: SummaryStyle): Promise<Result<Summary | null, AppError>> {
    try {
      const db = this.ensureDb();
      const now = Date.now();

      const row = db.prepare(`
        SELECT * FROM summaries
        WHERE video_id = ? AND style = ? AND expires_at > ?
      `).get(videoId.value, style, now) as
        | {
            id: string;
            video_id: string;
            style: string;
            source: string;
            summary: string;
            key_points: string;
            timestamps: string;
            generated_at: string;
            model: string;
            token_usage: string | null;
            transcript_id: string | null;
            expires_at: number;
          }
        | undefined;

      if (!row) {
        return ok(null);
      }

      const summaryResult = Summary.reconstruct({
        id: row.id,
        videoId: row.video_id,
        style: row.style,
        source: row.source as Summary['source'],
        summary: row.summary,
        keyPoints: JSON.parse(row.key_points),
        timestamps: JSON.parse(row.timestamps),
        generatedAt: row.generated_at,
        model: row.model,
        tokenUsage: row.token_usage ? JSON.parse(row.token_usage) : undefined,
        transcriptId: row.transcript_id ?? undefined,
      });

      if (!summaryResult.ok) {
        this.logger.error('Failed to reconstruct summary from cache', {
          videoId: videoId.value,
          style,
          error: summaryResult.error.message,
        });
        await this.delete(videoId, style);
        return err(summaryResult.error);
      }

      return ok(summaryResult.value);
    } catch (error) {
      return err(new AppError(ErrorCodes.CACHE_READ_FAILED, 'Failed to read summary from cache', {
        cause: error instanceof Error ? error : undefined,
        context: { videoId: videoId.value, style },
      }));
    }
  }

  async set(summary: Summary, ttlSeconds?: number): Promise<Result<void, AppError>> {
    try {
      const db = this.ensureDb();
      const ttl = ttlSeconds ?? this.config.ttlSeconds;
      const expiresAt = Date.now() + ttl * 1000;
      const data = summary.toJSON();

      db.prepare(`
        INSERT OR REPLACE INTO summaries (id, video_id, style, source, summary, key_points, timestamps, generated_at, model, token_usage, transcript_id, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.id,
        data.videoId,
        data.style,
        data.source,
        data.summary,
        JSON.stringify(data.keyPoints),
        JSON.stringify(data.timestamps),
        data.generatedAt,
        data.model,
        data.tokenUsage ? JSON.stringify(data.tokenUsage) : null,
        data.transcriptId ?? null,
        expiresAt
      );

      this.logger.debug('Summary cached', {
        videoId: summary.videoId.value,
        style: summary.style,
        ttlSeconds: ttl,
      });

      return ok(undefined);
    } catch (error) {
      return err(new AppError(ErrorCodes.CACHE_WRITE_FAILED, 'Failed to write summary to cache', {
        cause: error instanceof Error ? error : undefined,
        context: { videoId: summary.videoId.value, style: summary.style },
      }));
    }
  }

  async has(videoId: VideoId, style: SummaryStyle): Promise<Result<boolean, AppError>> {
    try {
      const db = this.ensureDb();
      const now = Date.now();

      const count = db.prepare(`
        SELECT COUNT(*) as count FROM summaries
        WHERE video_id = ? AND style = ? AND expires_at > ?
      `).get(videoId.value, style, now) as { count: number };

      return ok(count.count > 0);
    } catch (error) {
      return err(new AppError(ErrorCodes.CACHE_READ_FAILED, 'Failed to check cache', {
        cause: error instanceof Error ? error : undefined,
        context: { videoId: videoId.value, style },
      }));
    }
  }

  async delete(videoId: VideoId, style: SummaryStyle): Promise<Result<boolean, AppError>> {
    try {
      const db = this.ensureDb();

      const result = db.prepare(`
        DELETE FROM summaries WHERE video_id = ? AND style = ?
      `).run(videoId.value, style);

      return ok(result.changes > 0);
    } catch (error) {
      return err(new AppError(ErrorCodes.CACHE_WRITE_FAILED, 'Failed to delete summary from cache', {
        cause: error instanceof Error ? error : undefined,
        context: { videoId: videoId.value, style },
      }));
    }
  }

  async clear(): Promise<Result<void, AppError>> {
    try {
      const db = this.ensureDb();
      db.prepare('DELETE FROM summaries').run();
      return ok(undefined);
    } catch (error) {
      return err(new AppError(ErrorCodes.CACHE_WRITE_FAILED, 'Failed to clear cache', {
        cause: error instanceof Error ? error : undefined,
      }));
    }
  }

  async keys(): Promise<Result<string[], AppError>> {
    try {
      const db = this.ensureDb();
      const now = Date.now();

      const rows = db.prepare(`
        SELECT video_id, style FROM summaries WHERE expires_at > ?
      `).all(now) as { video_id: string; style: string }[];

      return ok(rows.map(r => `${r.video_id}:${r.style}`));
    } catch (error) {
      return err(new AppError(ErrorCodes.CACHE_READ_FAILED, 'Failed to get cache keys', {
        cause: error instanceof Error ? error : undefined,
      }));
    }
  }

  async stats(): Promise<Result<{ count: number; sizeBytes: number }, AppError>> {
    try {
      const db = this.ensureDb();
      const now = Date.now();

      const countRow = db.prepare(`
        SELECT COUNT(*) as count FROM summaries WHERE expires_at > ?
      `).get(now) as { count: number };

      const sizeRow = db.prepare(`
        SELECT SUM(LENGTH(summary) + LENGTH(key_points) + LENGTH(timestamps)) as size FROM summaries WHERE expires_at > ?
      `).get(now) as { size: number | null };

      return ok({
        count: countRow.count,
        sizeBytes: sizeRow.size ?? 0,
      });
    } catch (error) {
      return err(new AppError(ErrorCodes.CACHE_READ_FAILED, 'Failed to get cache stats', {
        cause: error instanceof Error ? error : undefined,
      }));
    }
  }

  async healthCheck(): Promise<Result<{ healthy: boolean; details?: Record<string, unknown> }, AppError>> {
    try {
      if (!this.db) {
        return ok({ healthy: false, details: { reason: 'Not initialized' } });
      }

      this.db.prepare('SELECT 1').get();
      const stats = await this.stats();

      return ok({
        healthy: true,
        details: {
          type: 'sqlite',
          path: this.config.sqlitePath,
          ...(stats.ok ? stats.value : {}),
        },
      });
    } catch (error) {
      return ok({ healthy: false, details: { error: error instanceof Error ? error.message : String(error) } });
    }
  }

  private startCleanupInterval(): void {
    if (this.config.cleanupIntervalMs <= 0) return;

    setInterval(async () => {
      try {
        const db = this.ensureDb();
        const now = Date.now();
        const result = db.prepare('DELETE FROM summaries WHERE expires_at <= ?').run(now);
        if (result.changes > 0) {
          this.logger.debug('Cleaned up expired summaries', { deleted: result.changes });
        }
      } catch (error) {
        this.logger.error('Summary cache cleanup failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }, this.config.cleanupIntervalMs);
  }
}