import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getCurrentUser, isAdmin, mapUser, toClientUser, USER_COLUMNS } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) return NextResponse.json({ error: "无权访问" }, { status: 403 });

  const url = new URL(req.url);
  const keyword = (url.searchParams.get("keyword") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
  const offset = (page - 1) * pageSize;

  const totalRes = await query(
    `SELECT count(*) AS total FROM users
      WHERE ($1 = '' OR username ILIKE '%'||$1||'%' OR email ILIKE '%'||$1||'%' OR display_name ILIKE '%'||$1||'%')`,
    [keyword],
  );
  const rows = await query(
    `SELECT ${USER_COLUMNS} FROM users
      WHERE ($1 = '' OR username ILIKE '%'||$1||'%' OR email ILIKE '%'||$1||'%' OR display_name ILIKE '%'||$1||'%')
      ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [keyword, pageSize, offset],
  );
  return NextResponse.json({
    items: rows.rows.map((row) => ({ ...mapUser(row) })),
    total: Number(totalRes.rows[0].total),
  });
}

export async function POST(req: Request) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) return NextResponse.json({ error: "无权访问" }, { status: 403 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const id = body.id ? String(body.id) : "";
  const username = String(body.username || "").trim();
  const email = body.email ? String(body.email) : null;
  const displayName = body.displayName ? String(body.displayName) : null;
  const role = body.role === "admin" ? "admin" : "user";
  const status = body.status === "ban" ? "ban" : "active";
  const password = body.password ? String(body.password) : "";

  if (!username) return NextResponse.json({ error: "用户名不能为空" }, { status: 400 });

  if (id) {
    await query(
      `UPDATE users SET username=$2, email=$3, display_name=$4, role=$5, status=$6,
         ${password ? "password_hash=$7," : ""} updated_at=now() WHERE id=$1`,
      password
        ? [id, username, email, displayName, role, status, hashPassword(password)]
        : [id, username, email, displayName, role, status],
    );
    const updated = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id=$1`, [id]);
    return NextResponse.json({ user: updated.rows[0] ? toClientUser(mapUser(updated.rows[0])) : null });
  }

  const newId = randomUUID();
  await query(
    `INSERT INTO users (id, username, email, display_name, role, status, auth_provider, password_hash, email_verified)
     VALUES ($1,$2,$3,$4,$5,$6,'password',$7,true)`,
    [newId, username, email, displayName, role, status, password ? hashPassword(password) : null],
  );
  return NextResponse.json({ ok: true, id: newId });
}
