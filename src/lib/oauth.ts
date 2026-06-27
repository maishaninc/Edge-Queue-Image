import "server-only";
import { randomUUID } from "node:crypto";

import { query } from "@/lib/db";
import { getPrivateSettings } from "@/lib/settings";
import type { PrivateOAuthProvider } from "@/lib/settings-defaults";
import { mapUser, USER_COLUMNS, type AppUser } from "@/lib/session";

export type OAuthProvider = "google" | "github";

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "github";
}

export type OAuthProfile = {
  providerId: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
};

/** Public site origin used to build OAuth redirect URIs. */
export function resolveAppOrigin(req: Request, appOrigin: string): string {
  const configured = appOrigin.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

export async function getOAuthConfig(provider: OAuthProvider): Promise<PrivateOAuthProvider> {
  const settings = await getPrivateSettings();
  return settings.auth[provider];
}

export function buildAuthorizeUrl(
  cfg: PrivateOAuthProvider,
  opts: { redirectUri: string; state: string },
): string {
  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", cfg.scope);
  url.searchParams.set("state", opts.state);
  return url.toString();
}

export async function exchangeCodeForToken(
  cfg: PrivateOAuthProvider,
  opts: { code: string; redirectUri: string },
): Promise<string> {
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code: opts.code,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!response.ok) {
    throw new Error(`OAuth token exchange failed (${response.status})`);
  }
  const data = (await response.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || "OAuth token exchange returned no access_token");
  }
  return data.access_token;
}

export async function fetchOAuthProfile(
  provider: OAuthProvider,
  cfg: PrivateOAuthProvider,
  accessToken: string,
): Promise<OAuthProfile> {
  const response = await fetch(cfg.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: provider === "github" ? "application/vnd.github+json" : "application/json",
      "User-Agent": "edge-queue-image",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch OAuth profile (${response.status})`);
  }
  const data = (await response.json()) as Record<string, unknown>;

  if (provider === "google") {
    return {
      providerId: String(data.sub ?? ""),
      email: typeof data.email === "string" ? data.email : null,
      name: typeof data.name === "string" ? data.name : null,
      avatar: typeof data.picture === "string" ? data.picture : null,
    };
  }

  // GitHub: email may be private — resolve the primary verified email separately.
  let email = typeof data.email === "string" ? data.email : null;
  if (!email) {
    email = await fetchGithubPrimaryEmail(cfg.userInfoUrl, accessToken);
  }
  return {
    providerId: String(data.id ?? ""),
    email,
    name: (typeof data.name === "string" && data.name) || (typeof data.login === "string" ? data.login : null),
    avatar: typeof data.avatar_url === "string" ? data.avatar_url : null,
  };
}

async function fetchGithubPrimaryEmail(userInfoUrl: string, accessToken: string): Promise<string | null> {
  try {
    const emailsUrl = userInfoUrl.replace(/\/?$/, "") + "/emails";
    const response = await fetch(emailsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "edge-queue-image",
      },
    });
    if (!response.ok) return null;
    const emails = (await response.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
    const primary = emails.find((item) => item.primary && item.verified) || emails.find((item) => item.verified);
    return primary?.email ?? null;
  } catch {
    return null;
  }
}

async function uniqueUsername(profile: OAuthProfile, provider: OAuthProvider): Promise<string> {
  const base =
    (profile.email ? profile.email.split("@")[0] : "") ||
    (profile.name ? profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "") : "") ||
    `${provider}user`;
  const clean = base.replace(/[^a-z0-9_]+/gi, "").slice(0, 20) || `${provider}user`;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? clean : `${clean}${Math.floor(1000 + Math.random() * 9000)}`;
    const exists = await query("SELECT 1 FROM users WHERE username = $1", [candidate]);
    if (exists.rowCount === 0) return candidate;
  }
  return `${clean}_${randomUUID().slice(0, 8)}`;
}

/** Find-or-create the user behind an OAuth identity, linking by provider id then email. */
export async function upsertOAuthUser(provider: OAuthProvider, profile: OAuthProfile): Promise<AppUser> {
  if (!profile.providerId) throw new Error("OAuth profile missing provider id");
  const idCol = provider === "google" ? "google_id" : "github_id";

  const byId = await query(`SELECT ${USER_COLUMNS} FROM users WHERE ${idCol} = $1`, [profile.providerId]);
  if (byId.rows[0]) {
    await query(
      `UPDATE users SET avatar_url = COALESCE($1, avatar_url), display_name = COALESCE(display_name, $2),
         last_login_at = now(), updated_at = now() WHERE id = $3`,
      [profile.avatar, profile.name, byId.rows[0].id],
    );
    return mapUser(byId.rows[0]);
  }

  if (profile.email) {
    const byEmail = await query(`SELECT ${USER_COLUMNS} FROM users WHERE email = $1`, [profile.email]);
    if (byEmail.rows[0]) {
      await query(
        `UPDATE users SET ${idCol} = $1, avatar_url = COALESCE(avatar_url, $2),
           email_verified = true, last_login_at = now(), updated_at = now() WHERE id = $3`,
        [profile.providerId, profile.avatar, byEmail.rows[0].id],
      );
      return mapUser(byEmail.rows[0]);
    }
  }

  const id = randomUUID();
  const username = await uniqueUsername(profile, provider);
  const inserted = await query(
    `INSERT INTO users (id, username, email, display_name, avatar_url, role, status, auth_provider, ${idCol}, email_verified, last_login_at)
     VALUES ($1, $2, $3, $4, $5, 'user', 'active', $6, $7, $8, now())
     RETURNING ${USER_COLUMNS}`,
    [id, username, profile.email, profile.name || username, profile.avatar, provider, profile.providerId, Boolean(profile.email)],
  );
  return mapUser(inserted.rows[0]);
}

export function safeRedirect(value: string | null | undefined, fallback = "/image"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
