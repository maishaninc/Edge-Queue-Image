import "server-only";
import pg from "pg";
import type { PoolClient, PoolConfig, QueryResult, QueryResultRow } from "pg";

import { runMigrations } from "@/lib/migrate";

const { Pool } = pg;
type PgPool = InstanceType<typeof Pool>;

/**
 * Aiven PostgreSQL connection. Only two env vars are required:
 *  - DATABASE_URL       : the Aiven connection string (prefer the pooled/PgBouncer URI on serverless)
 *  - DATABASE_CA_CERT   : the full CA certificate PEM (enables strict TLS verification)
 *
 * A single module-level Pool is reused across invocations (kept on globalThis so
 * dev hot-reloads don't leak connections).
 */

function normalizePem(value: string): string {
  // Vercel env values may arrive with literal "\n" sequences instead of newlines.
  return value.includes("-----BEGIN") && value.includes("\\n")
    ? value.replace(/\\n/g, "\n")
    : value;
}

function sslConfig(): PoolConfig["ssl"] {
  const ca = process.env.DATABASE_CA_CERT?.trim();
  if (ca) return { ca: normalizePem(ca), rejectUnauthorized: true };

  const url = process.env.DATABASE_URL || "";
  if (/sslmode=require/i.test(url) || /aivencloud\.com/i.test(url)) {
    // TLS required but no CA supplied (e.g. local testing) — encrypt without strict verify.
    return { rejectUnauthorized: false };
  }
  return undefined;
}

type GlobalWithPool = typeof globalThis & {
  __eqiPgPool?: PgPool;
  __eqiMigrated?: Promise<void>;
};
const globalForPg = globalThis as GlobalWithPool;

export function getPool(): PgPool {
  if (!globalForPg.__eqiPgPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set. See .env.example.");
    }
    globalForPg.__eqiPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig(),
      max: Number(process.env.PG_POOL_MAX || 3),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
    });
  }
  return globalForPg.__eqiPgPool;
}

/** Run schema migrations + seeding exactly once per process. */
export function ensureMigrated(): Promise<void> {
  if (!globalForPg.__eqiMigrated) {
    globalForPg.__eqiMigrated = runMigrations(getPool()).catch((error) => {
      globalForPg.__eqiMigrated = undefined;
      throw error;
    });
  }
  return globalForPg.__eqiMigrated;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  await ensureMigrated();
  return getPool().query<T>(text, params as never[]);
}

/** Run a function inside a transaction with a dedicated pooled client. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureMigrated();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    throw error;
  } finally {
    client.release();
  }
}
