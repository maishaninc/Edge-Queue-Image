import { createClient, type Client } from '@libsql/client';
import { getTursoConfig } from './env';

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

export function getDb() {
  if (client) return client;
  const { url, authToken } = getTursoConfig();
  if (!url || (!authToken && !url.startsWith('file:'))) {
    throw new Error('Database is not configured. Set TURSO_DATABASE_URL. TURSO_AUTH_TOKEN is required only for remote Turso URLs.');
  }
  client = createClient({ url, authToken });
  return client;
}

async function ensureColumn(db: Client, table: string, column: string, definition: string) {
  const result = await db.execute(`PRAGMA table_info(${table})`);
  const exists = result.rows.some((row) => String(row.name) === column);
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function ensureSchema(db = getDb()) {
  if (schemaReady) return schemaReady;

  schemaReady = (async () => {
    await db.execute(
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
          expires_at TEXT,
          quality TEXT NOT NULL DEFAULT '1K',
          aspect_ratio TEXT NOT NULL DEFAULT '1:1',
          result_url TEXT,
          result_b64 TEXT,
          error_code TEXT,
          error_message_safe TEXT
        )`,
    );

    await ensureColumn(db, 'jobs', 'expires_at', 'TEXT');
    await ensureColumn(db, 'jobs', 'quality', "TEXT NOT NULL DEFAULT '1K'");
    await ensureColumn(db, 'jobs', 'aspect_ratio', "TEXT NOT NULL DEFAULT '1:1'");

    await db.batch(
      [
        'CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs(status, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_jobs_status_priority_created_at ON jobs(status, is_priority, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_jobs_running_started_at ON jobs(status, started_at)',
        'CREATE INDEX IF NOT EXISTS idx_jobs_expires_at ON jobs(expires_at)',
        `CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS admin_login_attempts (
          ip_hash TEXT PRIMARY KEY,
          failed_count INTEGER NOT NULL DEFAULT 0,
          last_failed_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS job_rate_limits (
          ip_hash TEXT NOT NULL,
          created_at TEXT NOT NULL
        )`,
        'CREATE INDEX IF NOT EXISTS idx_job_rate_limits_ip_created_at ON job_rate_limits(ip_hash, created_at)',
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
