import type { Client } from '@libsql/client';
import { ensureSchema, getDb } from './db';

const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_FAILURES = 5;
const JOB_RATE_WINDOW_MS = 10 * 60 * 1000;
const JOB_RATE_MAX_SUBMISSIONS = 10;

export type AdminLoginAttempt = {
  failedCount: number;
  lastFailedAt: string;
};

export function isAdminLoginLocked(attempt: AdminLoginAttempt | null, now = Date.now()) {
  if (!attempt || attempt.failedCount < ADMIN_LOGIN_MAX_FAILURES) return false;
  return now - new Date(attempt.lastFailedAt).getTime() <= ADMIN_LOGIN_WINDOW_MS;
}

export function isJobRateLimited(createdAtValues: string[], now = Date.now()) {
  const cutoff = now - JOB_RATE_WINDOW_MS;
  const recent = createdAtValues.filter((value) => new Date(value).getTime() >= cutoff);
  return recent.length >= JOB_RATE_MAX_SUBMISSIONS;
}

export async function getAdminLoginAttempt(ipHash: string, db: Client = getDb()) {
  await ensureSchema(db);
  const result = await db.execute({
    sql: 'SELECT failed_count, last_failed_at FROM admin_login_attempts WHERE ip_hash = ? LIMIT 1',
    args: [ipHash],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    failedCount: Number(row.failed_count || 0),
    lastFailedAt: String(row.last_failed_at),
  };
}

export async function isAdminLoginLockedForIp(ipHash: string, db: Client = getDb()) {
  return isAdminLoginLocked(await getAdminLoginAttempt(ipHash, db));
}

export async function recordAdminLoginFailure(ipHash: string, db: Client = getDb()) {
  await ensureSchema(db);
  await db.execute({
    sql: `INSERT INTO admin_login_attempts (ip_hash, failed_count, last_failed_at)
      VALUES (?, 1, ?)
      ON CONFLICT(ip_hash) DO UPDATE SET
        failed_count = CASE
          WHEN admin_login_attempts.last_failed_at < ? THEN 1
          ELSE admin_login_attempts.failed_count + 1
        END,
        last_failed_at = excluded.last_failed_at`,
    args: [
      ipHash,
      new Date().toISOString(),
      new Date(Date.now() - ADMIN_LOGIN_WINDOW_MS).toISOString(),
    ],
  });
}

export async function clearAdminLoginFailures(ipHash: string, db: Client = getDb()) {
  await ensureSchema(db);
  await db.execute({
    sql: 'DELETE FROM admin_login_attempts WHERE ip_hash = ?',
    args: [ipHash],
  });
}

export async function isJobRateLimitedForIp(ipHash: string, db: Client = getDb()) {
  await ensureSchema(db);
  const cutoff = new Date(Date.now() - JOB_RATE_WINDOW_MS).toISOString();
  await db.execute({
    sql: 'DELETE FROM job_rate_limits WHERE created_at < ?',
    args: [cutoff],
  });
  const result = await db.execute({
    sql: 'SELECT created_at FROM job_rate_limits WHERE ip_hash = ? AND created_at >= ?',
    args: [ipHash, cutoff],
  });
  return isJobRateLimited(result.rows.map((row) => String(row.created_at)));
}

export async function recordJobSubmission(ipHash: string, db: Client = getDb()) {
  await ensureSchema(db);
  await db.execute({
    sql: 'INSERT INTO job_rate_limits (ip_hash, created_at) VALUES (?, ?)',
    args: [ipHash, new Date().toISOString()],
  });
}
