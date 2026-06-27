import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { verifyCaptcha } from "@/lib/captcha";
import { getCapacity, processGeneration, queueAheadCount } from "@/lib/queue";
import { getCurrentUser } from "@/lib/session";
import { getPrivateSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseBody(body: Record<string, unknown>) {
  const references = Array.isArray(body.references)
    ? (body.references as unknown[]).filter((r): r is string => typeof r === "string").slice(0, 4)
    : undefined;
  return {
    model: String(body.model || "").trim(),
    prompt: String(body.prompt || "").trim(),
    size: body.size ? String(body.size) : undefined,
    quality: body.quality ? String(body.quality) : undefined,
    count: Math.min(4, Math.max(1, Number(body.count) || 1)),
    references: references && references.length ? references : undefined,
  };
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let raw: Record<string, unknown> = {};
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const input = parseBody(raw);
  if (!input.model) return NextResponse.json({ error: "缺少模型" }, { status: 400 });
  if (!input.prompt) return NextResponse.json({ error: "请输入生图提示词" }, { status: 400 });

  const captcha = await verifyCaptcha(typeof raw.captchaToken === "string" ? raw.captchaToken : undefined);
  if (!captcha.ok) return NextResponse.json({ error: captcha.error || "人机验证未通过" }, { status: 400 });

  const settings = await getPrivateSettings();
  const activeLimit = Math.max(1, settings.queue.activeLimit || 2);
  const maxQueue = Math.max(0, settings.queue.maxQueue || 20);

  // Per-user daily cap (0 = unlimited) — abuse / cost protection for a free site.
  const dailyLimit = settings.queue.dailyLimit || 0;
  if (dailyLimit > 0) {
    const used = await query(
      "SELECT count(*) AS c FROM generation_histories WHERE user_id = $1 AND created_at > now() - interval '1 day'",
      [user.id],
    );
    if (Number(used.rows[0].c) >= dailyLimit) {
      return NextResponse.json({ error: "今日生成次数已达上限，请明天再试" }, { status: 429 });
    }
  }

  const { active, queued } = await getCapacity();

  if (active < activeLimit) {
    const jobId = randomUUID();
    await query(
      `INSERT INTO generation_jobs (id, user_id, status, model, prompt, request, started_at)
       VALUES ($1,$2,'executing',$3,$4,$5, now())`,
      [jobId, user.id, input.model, input.prompt, JSON.stringify(input)],
    );
    try {
      const result = await processGeneration(user, input);
      await query("UPDATE generation_jobs SET status='succeeded', history_id=$2, finished_at=now() WHERE id=$1", [
        jobId,
        result.historyId,
      ]);
      return NextResponse.json({
        status: "succeeded",
        taskId: jobId,
        historyId: result.historyId,
        images: result.images,
        durationMs: result.durationMs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败";
      await query("UPDATE generation_jobs SET status='failed', error=$2, finished_at=now() WHERE id=$1", [jobId, message]);
      return NextResponse.json({ status: "failed", taskId: jobId, error: message });
    }
  }

  if (queued >= maxQueue) {
    return NextResponse.json({ error: "当前排队人数较多，请稍后再试" }, { status: 429 });
  }
  const jobId = randomUUID();
  await query(
    `INSERT INTO generation_jobs (id, user_id, status, model, prompt, request)
     VALUES ($1,$2,'queued',$3,$4,$5)`,
    [jobId, user.id, input.model, input.prompt, JSON.stringify(input)],
  );
  const ahead = await queueAheadCount(jobId);
  return NextResponse.json({ status: "queued", taskId: jobId, queuePosition: ahead + 1, aheadCount: ahead });
}
