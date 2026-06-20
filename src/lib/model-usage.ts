import type { Client } from '@libsql/client';
import { getDb } from './db';
import { isDatabaseConfigured } from './env';

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export async function isModelDailyLimitReached(modelId: string, dailyLimit: number, db: Client = getDb()): Promise<boolean> {
  if (!dailyLimit || !isDatabaseConfigured()) return false;
  const result = await db.execute({
    sql: 'SELECT used_count FROM model_daily_usage WHERE model_id = ? AND usage_date = ?',
    args: [modelId, todayUtc()],
  });
  const count = result.rows[0] ? Number(result.rows[0].used_count) : 0;
  return count >= dailyLimit;
}

export async function recordModelUsage(modelId: string, db: Client = getDb()): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await db.execute({
    sql: `INSERT INTO model_daily_usage (model_id, usage_date, used_count) VALUES (?, ?, 1)
          ON CONFLICT(model_id, usage_date) DO UPDATE SET used_count = used_count + 1`,
    args: [modelId, todayUtc()],
  });
}
