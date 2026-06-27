import { NextResponse } from "next/server";

import { getCurrentUser, isAdmin } from "@/lib/session";
import { getSettings, getPrivateSettings, saveSettings } from "@/lib/settings";
import type { ModelChannel, PrivateSettings, PublicSettings } from "@/lib/settings-defaults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Redact secrets before sending settings to the admin browser. The save path
 * preserves blanks (`pruneEmptySecrets` + channel-key reuse by name), so the UI
 * keeps working without ever shipping the real clientSecret / apiKey / secretKey.
 */
function redactSecrets(settings: { public: PublicSettings; private: PrivateSettings }) {
  const priv = settings.private;
  return {
    public: settings.public,
    private: {
      ...priv,
      auth: {
        google: { ...priv.auth.google, clientSecret: "" },
        github: { ...priv.auth.github, clientSecret: "" },
      },
      captcha: { ...priv.captcha, secretKey: "" },
      channels: priv.channels.map((channel) => ({ ...channel, apiKey: "" })),
    },
  };
}

export async function GET() {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) return NextResponse.json({ error: "无权访问" }, { status: 403 });
  const settings = await getSettings();
  return NextResponse.json(redactSecrets(settings));
}

/** Preserve existing secrets when the admin leaves a secret field blank. */
function pruneEmptySecrets(priv: Partial<PrivateSettings> | undefined) {
  if (!priv) return;
  const auth = priv.auth as PrivateSettings["auth"] | undefined;
  if (auth) {
    for (const key of ["google", "github"] as const) {
      if (auth[key] && auth[key].clientSecret === "") delete (auth[key] as { clientSecret?: string }).clientSecret;
    }
  }
  if (priv.captcha && priv.captcha.secretKey === "") delete (priv.captcha as { secretKey?: string }).secretKey;
}

export async function POST(req: Request) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) return NextResponse.json({ error: "无权访问" }, { status: 403 });

  let body: { public?: Record<string, unknown>; private?: Record<string, unknown> } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  // Reuse existing channel API keys when the admin leaves them blank.
  if (body.private && Array.isArray((body.private as Partial<PrivateSettings>).channels)) {
    const current = await getPrivateSettings();
    const priv = body.private as Partial<PrivateSettings>;
    priv.channels = (priv.channels as ModelChannel[]).map((channel) => {
      if (!channel.apiKey) {
        const prev = current.channels.find((c) => c.name === channel.name);
        if (prev) return { ...channel, apiKey: prev.apiKey };
      }
      return channel;
    });
  }
  pruneEmptySecrets(body.private as Partial<PrivateSettings>);

  await saveSettings(body);
  const settings = await getSettings();
  return NextResponse.json(redactSecrets(settings));
}
