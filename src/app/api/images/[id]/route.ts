import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const res = await query("SELECT user_id, data, mime_type, expires_at FROM generation_images WHERE id = $1", [id]);
  const row = res.rows[0];
  if (!row || !row.data) return new NextResponse("Not found", { status: 404 });
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return new NextResponse("Expired", { status: 410 });
  }
  if (row.user_id !== user.id && !isAdmin(user)) return new NextResponse("Forbidden", { status: 403 });

  const bytes = new Uint8Array(row.data as Buffer);
  // Never trust the stored mime for sniffing — force an image/* type and disable sniffing
  // so a hostile provider can't smuggle HTML/JS through the image endpoint (stored XSS).
  const rawMime = String(row.mime_type || "image/png");
  const mime = /^image\/[a-z0-9.+-]+$/i.test(rawMime) ? rawMime : "image/png";
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=86400",
      "Content-Length": String(bytes.byteLength),
    },
  });
}
