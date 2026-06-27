import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  exchangeCodeForToken,
  fetchOAuthProfile,
  isOAuthProvider,
  resolveAppOrigin,
  safeRedirect,
  upsertOAuthUser,
} from "@/lib/oauth";
import { getPrivateSettings } from "@/lib/settings";
import { applySessionCookie, createSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OAUTH_STATE_COOKIE = "eqi_oauth";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, url.origin));

  if (!isOAuthProvider(provider)) return fail("不支持的登录方式");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const raw = store.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !raw) return fail("登录会话已失效，请重试");

  let saved: { provider?: string; state?: string; redirect?: string };
  try {
    saved = JSON.parse(raw);
  } catch {
    return fail("登录会话无效");
  }
  if (saved.provider !== provider || saved.state !== state) return fail("登录校验失败");

  try {
    const settings = await getPrivateSettings();
    const cfg = settings.auth[provider];
    const origin = resolveAppOrigin(req, settings.runtime.appOrigin);
    const redirectUri = `${origin}/api/auth/oauth/${provider}/callback`;

    const accessToken = await exchangeCodeForToken(cfg, { code, redirectUri });
    const profile = await fetchOAuthProfile(provider, cfg, accessToken);
    const user = await upsertOAuthUser(provider, profile);

    const { token, expireHours } = await createSession(user.id);
    const target = safeRedirect(saved.redirect);
    const res = NextResponse.redirect(new URL(target, origin));
    applySessionCookie(res, token, expireHours);
    res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch (error) {
    return fail(error instanceof Error ? error.message : "登录失败");
  }
}
