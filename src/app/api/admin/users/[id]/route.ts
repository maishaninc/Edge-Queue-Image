import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) return NextResponse.json({ error: "无权访问" }, { status: 403 });
  const { id } = await params;
  if (admin && admin.id === id) {
    return NextResponse.json({ error: "不能删除当前登录的管理员" }, { status: 400 });
  }
  await query("DELETE FROM users WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
