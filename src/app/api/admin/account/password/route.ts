import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Change the current (admin) account password — used for the forced first-login change. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let body: { newPassword?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const newPassword = String(body.newPassword || "");
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
  }

  await query(
    "UPDATE users SET password_hash=$1, must_change_password=false, updated_at=now() WHERE id=$2",
    [hashPassword(newPassword), user.id],
  );
  return NextResponse.json({ ok: true });
}
