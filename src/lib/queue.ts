import type { Client } from '@libsql/client';
import { getQueueRuntimeConfig } from './config';
import { ensureSchema, getDb } from './db';
import { generateImage } from './image-provider';
import type { ImageAspectRatio, ImageQuality } from './image-options';
import { resolveModelAsync } from './models';
import { todayUtc } from './request';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'expired';

export type QueueJob = {
  id: string;
  status: JobStatus;
  prompt: string;
  model_id: string;
  is_priority: number;
  ip_hash: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  expires_at: string | null;
  quality: ImageQuality;
  aspect_ratio: ImageAspectRatio;
  result_url: string | null;
  result_b64: string | null;
  error_code: string | null;
  error_message_safe: string | null;
};

export type QueueSnapshot = {
  runningCount: number;
  waitingCount: number;
  queuePosition: number | null;
};

export type SortableJob = {
  id: string;
  isPriority: boolean;
  createdAt: string;
};

export function sortQueuedJobsForDisplay(jobs: SortableJob[], concurrency: number) {
  const normal = jobs.filter((job) => !job.isPriority).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const priority = jobs.filter((job) => job.isPriority).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const protectedNormal = normal.slice(0, Math.max(0, concurrency));
  const remainingNormal = normal.slice(Math.max(0, concurrency));
  return [...protectedNormal, ...priority, ...remainingNormal];
}

function rowToJob(row: Record<string, unknown>): QueueJob {
  return {
    id: String(row.id),
    status: String(row.status) as JobStatus,
    prompt: String(row.prompt),
    model_id: String(row.model_id),
    is_priority: Number(row.is_priority),
    ip_hash: String(row.ip_hash),
    created_at: String(row.created_at),
    started_at: row.started_at ? String(row.started_at) : null,
    finished_at: row.finished_at ? String(row.finished_at) : null,
    expires_at: row.expires_at ? String(row.expires_at) : null,
    quality: (row.quality ? String(row.quality) : '1K') as ImageQuality,
    aspect_ratio: (row.aspect_ratio ? String(row.aspect_ratio) : '1:1') as ImageAspectRatio,
    result_url: row.result_url ? String(row.result_url) : null,
    result_b64: row.result_b64 ? String(row.result_b64) : null,
    error_code: row.error_code ? String(row.error_code) : null,
    error_message_safe: row.error_message_safe ? String(row.error_message_safe) : null,
  };
}

export async function getPriorityRemaining(ipHash: string, db = getDb()) {
  await ensureSchema(db);
  const { priorityDailyLimit, priorityQueueEnabled } = await getQueueRuntimeConfig();
  if (!priorityQueueEnabled) return 0;

  const result = await db.execute({
    sql: 'SELECT used_count FROM priority_usage WHERE ip_hash = ? AND usage_date = ?',
    args: [ipHash, todayUtc()],
  });
  const used = Number(result.rows[0]?.used_count || 0);
  return Math.max(0, priorityDailyLimit - used);
}

export async function consumePriority(ipHash: string, db: Client) {
  const remaining = await getPriorityRemaining(ipHash, db);
  if (remaining <= 0) {
    return false;
  }

  await db.execute({
    sql: `INSERT INTO priority_usage (ip_hash, usage_date, used_count)
      VALUES (?, ?, 1)
      ON CONFLICT(ip_hash, usage_date)
      DO UPDATE SET used_count = used_count + 1`,
    args: [ipHash, todayUtc()],
  });
  return true;
}

export async function createJob(input: {
  prompt: string;
  modelId: string;
  ipHash: string;
  usePriority: boolean;
  quality: ImageQuality;
  aspectRatio: ImageAspectRatio;
}) {
  const db = getDb();
  await ensureSchema(db);
  await cleanupExpiredJobs(db);
  const config = await getQueueRuntimeConfig();

  const waitingResult = await db.execute("SELECT COUNT(*) AS count FROM jobs WHERE status = 'queued'");
  const waitingCount = Number(waitingResult.rows[0]?.count || 0);
  if (waitingCount >= config.maxWaiting) {
    return { ok: false as const, error: 'queue_full' };
  }

  let priority = false;
  if (input.usePriority && config.priorityQueueEnabled) {
    const consumed = await consumePriority(input.ipHash, db);
    if (!consumed) {
      return { ok: false as const, error: 'priority_limit_reached' };
    }
    priority = true;
  }

  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO jobs (id, status, prompt, model_id, is_priority, ip_hash, created_at, quality, aspect_ratio)
      VALUES (?, 'queued', ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.prompt,
      input.modelId,
      priority ? 1 : 0,
      input.ipHash,
      new Date().toISOString(),
      input.quality,
      input.aspectRatio,
    ],
  });

  return { ok: true as const, id, isPriority: priority };
}

export async function cleanupExpiredJobs(db = getDb()) {
  await ensureSchema(db);
  await db.execute({
    sql: 'DELETE FROM jobs WHERE expires_at IS NOT NULL AND expires_at < ?',
    args: [new Date().toISOString()],
  });
}

async function resultExpiresAt(now = new Date()) {
  return new Date(now.getTime() + (await getQueueRuntimeConfig()).jobResultTtlMinutes * 60 * 1000).toISOString();
}

export function safeProviderErrorCode(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || 'provider_failed');
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized.slice(0, 120) || 'provider_failed';
}

export async function releaseExpiredRunningJobs(db = getDb()) {
  await ensureSchema(db);
  const config = await getQueueRuntimeConfig();
  const cutoff = new Date(Date.now() - config.runningJobTimeoutSeconds * 1000).toISOString();
  const now = new Date();
  await db.execute({
    sql: `UPDATE jobs
      SET status = 'expired', finished_at = ?, expires_at = ?, error_code = 'job_timeout', error_message_safe = 'Generation timed out.'
      WHERE status = 'running' AND started_at < ?`,
    args: [now.toISOString(), await resultExpiresAt(now), cutoff],
  });
}

async function getQueuedJobs(db: Client) {
  const result = await db.execute({
    sql: `SELECT id, is_priority, created_at FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1000`,
    args: [],
  });
  return result.rows.map((row) => ({
    id: String(row.id),
    isPriority: Number(row.is_priority) === 1,
    createdAt: String(row.created_at),
  }));
}

export async function getQueueSnapshot(jobId: string, db = getDb()): Promise<QueueSnapshot> {
  await ensureSchema(db);
  const [runningResult, queuedJobs] = await Promise.all([
    db.execute("SELECT COUNT(*) AS count FROM jobs WHERE status = 'running'"),
    getQueuedJobs(db),
  ]);

  const sorted = sortQueuedJobsForDisplay(queuedJobs, (await getQueueRuntimeConfig()).concurrency);
  const index = sorted.findIndex((job) => job.id === jobId);

  return {
    runningCount: Number(runningResult.rows[0]?.count || 0),
    waitingCount: queuedJobs.length,
    queuePosition: index >= 0 ? index + 1 : null,
  };
}

export async function getJob(id: string, db = getDb()) {
  await ensureSchema(db);
  const result = await db.execute({
    sql: 'SELECT * FROM jobs WHERE id = ? LIMIT 1',
    args: [id],
  });
  const row = result.rows[0];
  return row ? rowToJob(row) : null;
}

export async function claimNextJob(db = getDb()) {
  await ensureSchema(db);
  const config = await getQueueRuntimeConfig();
  const transaction = await db.transaction('write');

  try {
    const runningResult = await transaction.execute("SELECT COUNT(*) AS count FROM jobs WHERE status = 'running'");
    const runningCount = Number(runningResult.rows[0]?.count || 0);
    if (runningCount >= config.concurrency) {
      await transaction.rollback();
      return null;
    }

    const queuedResult = await transaction.execute({
      sql: `SELECT id, is_priority, created_at FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1000`,
      args: [],
    });
    const queuedJobs = queuedResult.rows.map((row) => ({
      id: String(row.id),
      isPriority: Number(row.is_priority) === 1,
      createdAt: String(row.created_at),
    }));
    const [next] = sortQueuedJobsForDisplay(queuedJobs, config.concurrency);
    if (!next) {
      await transaction.rollback();
      return null;
    }

    const startedAt = new Date().toISOString();
    const update = await transaction.execute({
      sql: `UPDATE jobs SET status = 'running', started_at = ?
        WHERE id = ? AND status = 'queued'
        RETURNING *`,
      args: [startedAt, next.id],
    });

    const row = update.rows[0];
    await transaction.commit();
    return row ? rowToJob(row) : null;
  } finally {
    transaction.close();
  }
}

export async function runClaimedJob(job: QueueJob, db = getDb()) {
  const model = await resolveModelAsync(job.model_id);
  if (!model) {
    await db.execute({
      sql: `UPDATE jobs SET status = 'failed', finished_at = ?, error_code = 'model_not_found', error_message_safe = ?
        WHERE id = ?`,
      args: [new Date().toISOString(), 'Model is no longer available.', job.id],
    });
    return;
  }

  try {
    const result = await generateImage({
      model,
      prompt: job.prompt,
      count: 1,
      quality: job.quality,
      aspectRatio: job.aspect_ratio,
    });

    const now = new Date();
    await db.execute({
      sql: `UPDATE jobs SET status = 'succeeded', finished_at = ?, expires_at = ?, result_url = ?, result_b64 = ?
        WHERE id = ?`,
      args: [now.toISOString(), await resultExpiresAt(now), result.url || null, result.b64 || null, job.id],
    });
  } catch (error) {
    const errorCode = safeProviderErrorCode(error);
    console.error('[queue] image provider failed', {
      jobId: job.id,
      modelId: job.model_id,
      errorCode,
      error: error instanceof Error ? error.message : String(error),
    });

    const now = new Date();
    await db.execute({
      sql: `UPDATE jobs SET status = 'failed', finished_at = ?, expires_at = ?, error_code = ?, error_message_safe = ?
        WHERE id = ?`,
      args: [now.toISOString(), await resultExpiresAt(now), errorCode, 'Image generation failed. Please try again later.', job.id],
    });
  }
}

export async function advanceQueue(limit = 1) {
  const db = getDb();
  await ensureSchema(db);
  await cleanupExpiredJobs(db);
  await releaseExpiredRunningJobs(db);

  const claimed: QueueJob[] = [];
  const config = await getQueueRuntimeConfig();
  for (let index = 0; index < Math.min(limit, config.concurrency); index += 1) {
    const job = await claimNextJob(db);
    if (!job) break;
    claimed.push(job);
  }

  await Promise.all(claimed.map((job) => runClaimedJob(job, db)));
  return claimed.length;
}
