import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { loadHistoryImages } from "@/lib/queue";
import { getCurrentUser, isAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin view of generation logs: who generated what, the prompt, model, and images. */
export async function GET(req: Request) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) return NextResponse.json({ error: "无权访问" }, { status: 403 });

  const url = new URL(req.url);
  const keyword = (url.searchParams.get("keyword") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
  const offset = (page - 1) * pageSize;

  const totalRes = await query(
    `SELECT count(*) AS total FROM generation_histories h
       LEFT JOIN users u ON u.id = h.user_id
      WHERE ($1 = '' OR h.prompt ILIKE '%'||$1||'%' OR u.username ILIKE '%'||$1||'%')`,
    [keyword],
  );
  const rows = await query(
    `SELECT h.id, h.user_id, h.prompt, h.model, h.status, h.image_count, h.size, h.quality,
            h.duration_ms, h.created_at, u.username, u.display_name, u.avatar_url
       FROM generation_histories h
       LEFT JOIN users u ON u.id = h.user_id
      WHERE ($1 = '' OR h.prompt ILIKE '%'||$1||'%' OR u.username ILIKE '%'||$1||'%')
      ORDER BY h.created_at DESC LIMIT $2 OFFSET $3`,
    [keyword, pageSize, offset],
  );

  const items = await Promise.all(
    rows.rows.map(async (row) => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      prompt: row.prompt,
      model: row.model,
      status: row.status,
      size: row.size,
      quality: row.quality,
      imageCount: row.image_count,
      durationMs: Number(row.duration_ms || 0),
      createdAt: row.created_at,
      images: await loadHistoryImages(row.id),
    })),
  );

  return NextResponse.json({ items, total: Number(totalRes.rows[0].total), page, pageSize });
}
