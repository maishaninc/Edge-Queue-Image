import "server-only";

import { query } from "@/lib/db";

const MAX_FAILS = 8;
const LOCK_MINUTES = 15;

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function isLoginBlocked(ip: string): Promise<boolean> {
  const result = await query("SELECT locked_until FROM login_attempts WHERE ip = $1", [ip]);
  const lockedUntil = result.rows[0]?.locked_until;
  return Boolean(lockedUntil && new Date(lockedUntil).getTime() > Date.now());
}

export async function recordLoginFailure(ip: string): Promise<void> {
  // Reset a stale lock window before counting this failure.
  await query(
    "UPDATE login_attempts SET fails = 0, locked_until = NULL WHERE ip = $1 AND locked_until IS NOT NULL AND locked_until < now()",
    [ip],
  );
  await query(
    `INSERT INTO login_attempts (ip, fails, updated_at) VALUES ($1, 1, now())
     ON CONFLICT (ip) DO UPDATE SET fails = login_attempts.fails + 1, updated_at = now()`,
    [ip],
  );
  await query(
    "UPDATE login_attempts SET locked_until = now() + make_interval(mins => $2) WHERE ip = $1 AND fails >= $3",
    [ip, LOCK_MINUTES, MAX_FAILS],
  );
}

export async function recordLoginSuccess(ip: string): Promise<void> {
  await query("DELETE FROM login_attempts WHERE ip = $1", [ip]);
}
