import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { getClientIp, isLoginBlocked, recordLoginFailure, recordLoginSuccess } from "@/lib/login-throttle";
import { verifyPassword } from "@/lib/password";
import {
  applySessionCookie,
  createSession,
  mapUser,
  toClientUser,
  touchLastLogin,
  USER_COLUMNS,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Username + password login. Only accounts that have a password (the admin by
 * default) can use this; regular users sign in via Google/GitHub OAuth.
 */
export async function POST(req: Request) {
  let body: { username?: string; password?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  if (!username || !password) {
    return NextResponse.json({ error: "请输入用户名和密码" }, { status: 400 });
  }

  const ip = getClientIp(req);
  if (await isLoginBlocked(ip)) {
    return NextResponse.json({ error: "登录尝试过于频繁，请 15 分钟后再试" }, { status: 429 });
  }

  const result = await query(
    `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE username = $1`,
    [username],
  );
  const row = result.rows[0];
  if (!row || row.status !== "active" || !verifyPassword(password, row.password_hash)) {
    await recordLoginFailure(ip);
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  await recordLoginSuccess(ip);
  await touchLastLogin(row.id);
  const { token, expireHours } = await createSession(row.id);
  const res = NextResponse.json({ user: toClientUser(mapUser(row)) });
  applySessionCookie(res, token, expireHours);
  return res;
}
