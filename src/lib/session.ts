import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";

import { query } from "@/lib/db";
import { getPrivateSettings } from "@/lib/settings";

export const SESSION_COOKIE = "eqi_session";

export type AppUser = {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: "user" | "admin";
  status: "active" | "ban";
  authProvider: string;
  googleId: string | null;
  githubId: string | null;
  mustChangePassword: boolean;
  emailVerified: boolean;
  credits: number;
  createdAt: string;
  lastLoginAt: string | null;
};

export const USER_COLUMNS = `id, username, email, display_name, avatar_url, role, status,
  auth_provider, google_id, github_id, must_change_password, email_verified, credits, created_at, last_login_at`;

function toIso(value: unknown): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export function mapUser(row: QueryResultRow): AppUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email ?? null,
    displayName: row.display_name ?? null,
    avatarUrl: row.avatar_url ?? null,
    role: row.role,
    status: row.status,
    authProvider: row.auth_provider,
    googleId: row.google_id ?? null,
    githubId: row.github_id ?? null,
    mustChangePassword: Boolean(row.must_change_password),
    emailVerified: Boolean(row.email_verified),
    credits: Number(row.credits ?? 0),
    createdAt: toIso(row.created_at) ?? "",
    lastLoginAt: toIso(row.last_login_at),
  };
}

/** The subset of user fields safe to send to the browser. */
export function toClientUser(user: AppUser) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName || user.username,
    avatarUrl: user.avatarUrl,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    credits: user.credits,
  };
}
export type ClientUser = ReturnType<typeof toClientUser>;

/** Create a server-side session and return its opaque token + lifetime in hours. */
export async function createSession(userId: string): Promise<{ token: string; expireHours: number }> {
  const expireHours = (await getPrivateSettings()).runtime.sessionExpireHours || 168;
  const token = randomBytes(32).toString("hex");
  await query(
    `INSERT INTO sessions (token, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(hours => $3::int))`,
    [token, userId, expireHours],
  );
  return { token, expireHours };
}

export async function deleteSession(token: string): Promise<void> {
  await query("DELETE FROM sessions WHERE token = $1", [token]);
}

/** Resolve the currently authenticated active user from the session cookie, or null. */
export async function getCurrentUser(): Promise<AppUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await query(
    `SELECT ${USER_COLUMNS} FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > now() AND u.status = 'active'`,
    [token],
  );
  const row = result.rows[0];
  return row ? mapUser(row) : null;
}

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

export async function touchLastLogin(userId: string): Promise<void> {
  await query("UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1", [userId]);
}

export function isAdmin(user: AppUser | null): user is AppUser {
  return Boolean(user && user.role === "admin");
}

/** Attach the session cookie to an outgoing response (works for JSON + redirects). */
export function applySessionCookie(res: NextResponse, token: string, expireHours: number): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expireHours * 3600,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
