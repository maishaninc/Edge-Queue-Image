import { createClient, type Client } from '@libsql/client';
import { getTursoConfig } from './config';

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

export function getDb() {
  if (client) return client;
  const { url, authToken } = getTursoConfig();
  if (!url || !authToken) {
    throw new Error('Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
  }
  client = createClient({ url, authToken });
  return client;
}

export async function ensureSchema(db = getDb()) {
  if (schemaReady) return schemaReady;

  schemaReady = (async () => {
    await db.batch(
      [
        `CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          prompt TEXT NOT NULL,
          model_id TEXT NOT NULL,
          is_priority INTEGER NOT NULL DEFAULT 0,
          ip_hash TEXT NOT NULL,
          created_at TEXT NOT NULL,
          started_at TEXT,
          finished_at TEXT,
          result_url TEXT,
          result_b64 TEXT,
          error_code TEXT,
          error_message_safe TEXT
        )`,
        'CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs(status, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_jobs_status_priority_created_at ON jobs(status, is_priority, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_jobs_running_started_at ON jobs(status, started_at)',
        `CREATE TABLE IF NOT EXISTS priority_usage (
          ip_hash TEXT NOT NULL,
          usage_date TEXT NOT NULL,
          used_count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (ip_hash, usage_date)
        )`,
      ],
      'write',
    );
  })();

  return schemaReady;
}
