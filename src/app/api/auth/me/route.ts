import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { getCurrentUser, toClientUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  const today = await query("SELECT (last_check_in_date = CURRENT_DATE) AS t FROM users WHERE id = $1", [user.id]);
  return NextResponse.json({ user: { ...toClientUser(user), checkedInToday: Boolean(today.rows[0]?.t) } });
}
