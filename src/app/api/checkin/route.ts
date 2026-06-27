import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getPrivateSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daily check-in: grants a fixed amount or a random amount within a range (admin-configured). */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const cfg = (await getPrivateSettings()).checkIn;
  if (!cfg.enabled) return NextResponse.json({ error: "签到未开启" }, { status: 400 });

  const check = await query("SELECT (last_check_in_date = CURRENT_DATE) AS t FROM users WHERE id = $1", [user.id]);
  if (check.rows[0]?.t) return NextResponse.json({ error: "今天已经签到过了" }, { status: 400 });

  let amount = cfg.amount;
  if (cfg.mode === "random") {
    const min = Math.min(cfg.min, cfg.max);
    const max = Math.max(cfg.min, cfg.max);
    amount = Math.floor(min + Math.random() * (max - min + 1));
  }
  amount = Math.max(0, Math.floor(amount));

  const updated = await query(
    "UPDATE users SET credits = credits + $1, last_check_in_date = CURRENT_DATE, updated_at = now() WHERE id = $2 RETURNING credits",
    [amount, user.id],
  );
  return NextResponse.json({ gained: amount, credits: updated.rows[0].credits });
}
