import "server-only";

import { getPrivateSettings } from "@/lib/settings";

/**
 * Server-side captcha verification. Returns ok=true when the provider is "none"
 * (disabled) or not fully configured, so enabling it is purely additive.
 */
export async function verifyCaptcha(token: string | undefined): Promise<{ ok: boolean; error?: string }> {
  const captcha = (await getPrivateSettings()).captcha;
  if (captcha.provider === "none") return { ok: true };
  if (!captcha.secretKey) return { ok: true }; // not fully set up — don't block users
  if (!token) return { ok: false, error: "请先完成人机验证" };

  const endpoint =
    captcha.provider === "turnstile"
      ? "https://challenges.cloudflare.com/turnstile/v0/siteverify"
      : "https://hcaptcha.com/siteverify";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: captcha.secretKey, response: token }),
    });
    const data = (await response.json()) as { success?: boolean };
    return data.success ? { ok: true } : { ok: false, error: "人机验证未通过，请重试" };
  } catch {
    return { ok: false, error: "人机验证服务异常，请稍后再试" };
  }
}
