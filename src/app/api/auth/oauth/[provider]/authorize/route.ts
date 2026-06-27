import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { buildAuthorizeUrl, isOAuthProvider, resolveAppOrigin, safeRedirect } from "@/lib/oauth";
import { getPrivateSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OAUTH_STATE_COOKIE = "eqi_oauth";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const redirect = safeRedirect(url.searchParams.get("redirect"));
  const loginError = (msg: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, url.origin));

  if (!isOAuthProvider(provider)) return loginError("不支持的登录方式");

  const settings = await getPrivateSettings();
  const cfg = settings.auth[provider];
  if (!cfg.enabled || !cfg.clientId || !cfg.clientSecret) {
    return loginError("该登录方式未启用");
  }

  const origin = resolveAppOrigin(req, settings.runtime.appOrigin);
  const redirectUri = `${origin}/api/auth/oauth/${provider}/callback`;
  const state = randomBytes(16).toString("hex");
  const authorizeUrl = buildAuthorizeUrl(cfg, { redirectUri, state });

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(OAUTH_STATE_COOKIE, JSON.stringify({ provider, state, redirect }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
