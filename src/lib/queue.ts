import "server-only";
import { randomUUID } from "node:crypto";

import { query } from "@/lib/db";
import { generateImages, selectChannel } from "@/lib/image-provider";
import { getPrivateSettings } from "@/lib/settings";
import type { AppUser } from "@/lib/session";

export type GeneratedImageMeta = {
  id: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  mime: string;
};

export type GenerationInput = {
  model: string;
  prompt: string;
  size?: string;
  quality?: string;
  count: number;
  references?: string[];
};

/** Load the stored image metadata for a history row (newest first). */
export async function loadHistoryImages(historyId: string): Promise<GeneratedImageMeta[]> {
  const result = await query(
    `SELECT id, width, height, bytes, mime_type FROM generation_images
      WHERE history_id = $1 ORDER BY created_at ASC`,
    [historyId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    url: `/api/images/${row.id}`,
    width: row.width ?? 0,
    height: row.height ?? 0,
    bytes: row.bytes ?? 0,
    mime: row.mime_type || "image/png",
  }));
}

/**
 * Run a generation end-to-end: resolve a channel, call the provider, persist a
 * history row + the image bytes (with TTL), and return the image metadata.
 */
export async function processGeneration(
  user: Pick<AppUser, "id">,
  input: GenerationInput,
): Promise<{ historyId: string; durationMs: number; images: GeneratedImageMeta[] }> {
  const settings = await getPrivateSettings();
  const channel = selectChannel(settings.channels, input.model);
  if (!channel) throw new Error("没有可用的图片模型渠道，请联系管理员在后台配置");

  const retentionDays = settings.imageRetentionDays || 7;
  const startedAt = Date.now();
  const generated = await generateImages(channel, {
    model: input.model,
    prompt: input.prompt,
    size: input.size,
    quality: input.quality,
    n: Math.max(1, input.count),
    references: input.references,
  });
  const durationMs = Date.now() - startedAt;

  const historyId = randomUUID();
  await query(
    `INSERT INTO generation_histories
       (id, user_id, type, title, prompt, model, config, status, duration_ms,
        success_count, fail_count, image_count, size, quality, expires_at)
     VALUES ($1,$2,'image',$3,$4,$5,$6,'success',$7,$8,0,$9,$10,$11,
        now() + make_interval(days => $12::int))`,
    [
      historyId,
      user.id,
      input.prompt.slice(0, 80),
      input.prompt,
      input.model,
      JSON.stringify({ size: input.size, quality: input.quality, count: input.count }),
      durationMs,
      generated.length,
      generated.length,
      input.size || "",
      input.quality || "",
      retentionDays,
    ],
  );

  const images: GeneratedImageMeta[] = [];
  for (const item of generated) {
    const imageId = randomUUID();
    const buffer = Buffer.from(item.b64, "base64");
    await query(
      `INSERT INTO generation_images
         (id, history_id, user_id, prompt, model, data, mime_type, width, height, bytes, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now() + make_interval(days => $11::int))`,
      [imageId, historyId, user.id, input.prompt, input.model, buffer, item.mime, item.width, item.height, buffer.length, retentionDays],
    );
    images.push({
      id: imageId,
      url: `/api/images/${imageId}`,
      width: item.width,
      height: item.height,
      bytes: buffer.length,
      mime: item.mime,
    });
  }

  return { historyId, durationMs, images };
}

/** Opportunistic cleanup of expired images + histories. Cheap; called from reads. */
export async function cleanupExpired(): Promise<void> {
  try {
    await query("DELETE FROM generation_images WHERE expires_at IS NOT NULL AND expires_at < now()");
    await query("DELETE FROM generation_histories WHERE expires_at IS NOT NULL AND expires_at < now()");
    await query("DELETE FROM sessions WHERE expires_at < now()");
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// Queue accounting + claiming (the generation queue this repo is named after).
// On serverless there is no background worker: a free slot processes inline in
// the submit request; otherwise the job is queued and a poll promotes it.
// ---------------------------------------------------------------------------

export async function getCapacity(): Promise<{ active: number; queued: number }> {
  const r = await query(
    `SELECT count(*) FILTER (WHERE status = 'executing') AS active,
            count(*) FILTER (WHERE status = 'queued')   AS queued
       FROM generation_jobs`,
  );
  return { active: Number(r.rows[0].active), queued: Number(r.rows[0].queued) };
}

export async function queueAheadCount(jobId: string): Promise<number> {
  const r = await query(
    `SELECT count(*) AS ahead FROM generation_jobs
      WHERE status = 'queued'
        AND created_at < (SELECT created_at FROM generation_jobs WHERE id = $1)`,
    [jobId],
  );
  return Number(r.rows[0]?.ahead ?? 0);
}

/** Atomically claim a queued job for execution when under the active limit. */
export async function claimQueuedJob(jobId: string, activeLimit: number): Promise<boolean> {
  const r = await query(
    `WITH active AS (SELECT count(*) AS c FROM generation_jobs WHERE status = 'executing')
     UPDATE generation_jobs SET status = 'executing', started_at = now()
      WHERE id = $1 AND status = 'queued' AND (SELECT c FROM active) < $2
      RETURNING id`,
    [jobId, activeLimit],
  );
  return r.rowCount === 1;
}
