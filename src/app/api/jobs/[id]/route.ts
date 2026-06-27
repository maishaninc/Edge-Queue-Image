import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { claimQueuedJob, loadHistoryImages, processGeneration, queueAheadCount } from "@/lib/queue";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { getPrivateSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type JobRequest = {
  model: string;
  prompt: string;
  size?: string;
  quality?: string;
  count?: number;
  references?: string[];
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const jobRes = await query("SELECT * FROM generation_jobs WHERE id = $1", [id]);
  const job = jobRes.rows[0];
  if (!job) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  if (job.user_id !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  if (job.status === "succeeded") {
    const images = job.history_id ? await loadHistoryImages(job.history_id) : [];
    return NextResponse.json({ status: "succeeded", historyId: job.history_id, images });
  }
  if (job.status === "failed") return NextResponse.json({ status: "failed", error: job.error });
  if (job.status === "canceled") return NextResponse.json({ status: "canceled" });

  if (job.status === "queued") {
    const settings = await getPrivateSettings();
    const activeLimit = Math.max(1, settings.queue.activeLimit || 2);
    const claimed = await claimQueuedJob(id, activeLimit);
    if (claimed) {
      const input = (job.request || {}) as JobRequest;
      try {
        const result = await processGeneration(user, {
          model: input.model,
          prompt: input.prompt,
          size: input.size,
          quality: input.quality,
          count: input.count || 1,
          references: input.references,
        });
        await query("UPDATE generation_jobs SET status='succeeded', history_id=$2, finished_at=now() WHERE id=$1", [
          id,
          result.historyId,
        ]);
        return NextResponse.json({ status: "succeeded", historyId: result.historyId, images: result.images });
      } catch (error) {
        const message = error instanceof Error ? error.message : "生成失败";
        await query("UPDATE generation_jobs SET status='failed', error=$2, finished_at=now() WHERE id=$1", [id, message]);
        return NextResponse.json({ status: "failed", error: message });
      }
    }
    const ahead = await queueAheadCount(id);
    return NextResponse.json({ status: "queued", queuePosition: ahead + 1, aheadCount: ahead });
  }

  return NextResponse.json({ status: "executing" });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  await query(
    "UPDATE generation_jobs SET status='canceled', finished_at=now() WHERE id=$1 AND user_id=$2 AND status='queued'",
    [id, user.id],
  );
  return NextResponse.json({ ok: true });
}
