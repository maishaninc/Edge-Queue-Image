import { NextResponse } from "next/server";

import { testChannelModel } from "@/lib/image-provider";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { getPrivateSettings } from "@/lib/settings";
import type { ModelChannel } from "@/lib/settings-defaults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) return NextResponse.json({ error: "无权访问" }, { status: 403 });

  let body: { channel?: ModelChannel; model?: string; index?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  let channel = body.channel;
  // When apiKey is blank, fall back to the stored channel (matched by index or name).
  if (channel && !channel.apiKey) {
    const settings = await getPrivateSettings();
    const stored =
      (typeof body.index === "number" ? settings.channels[body.index] : undefined) ||
      settings.channels.find((c) => c.name === channel!.name);
    if (stored) channel = { ...channel, apiKey: stored.apiKey, baseUrl: channel.baseUrl || stored.baseUrl };
  }

  const model = body.model || channel?.models?.[0];
  if (!channel || !channel.baseUrl || !channel.apiKey || !model) {
    return NextResponse.json({ ok: false, error: "渠道信息不完整" }, { status: 400 });
  }

  const result = await testChannelModel(channel, model);
  return NextResponse.json(result);
}
