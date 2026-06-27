import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { cleanupExpired, loadHistoryImages } from "@/lib/queue";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  void cleanupExpired();

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
  const offset = (page - 1) * pageSize;

  const totalRes = await query(
    "SELECT count(*) AS total FROM generation_histories WHERE user_id = $1 AND type = 'image'",
    [user.id],
  );
  const rows = await query(
    `SELECT id, title, prompt, model, config, status, duration_ms, success_count, fail_count,
            image_count, size, quality, created_at
       FROM generation_histories
      WHERE user_id = $1 AND type = 'image'
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
    [user.id, pageSize, offset],
  );

  const items = await Promise.all(
    rows.rows.map(async (row) => ({
      id: row.id,
      title: row.title,
      prompt: row.prompt,
      model: row.model,
      config: row.config,
      status: row.status,
      durationMs: Number(row.duration_ms || 0),
      successCount: row.success_count,
      failCount: row.fail_count,
      imageCount: row.image_count,
      size: row.size,
      quality: row.quality,
      createdAt: row.created_at,
      images: await loadHistoryImages(row.id),
    })),
  );

  return NextResponse.json({ items, total: Number(totalRes.rows[0].total), page, pageSize });
}
