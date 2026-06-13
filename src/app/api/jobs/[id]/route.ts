import { NextResponse, type NextRequest } from 'next/server';
import { advanceQueue, getJob, getQueueSnapshot } from '@/lib/queue';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    await advanceQueue(1);
    const job = await getJob(id);
    if (!job) {
      return NextResponse.json({ error: 'job_not_found' }, { status: 404 });
    }

    const snapshot = await getQueueSnapshot(id);
    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        modelId: job.model_id,
        isPriority: job.is_priority === 1,
        quality: job.quality,
        aspectRatio: job.aspect_ratio,
        expiresAt: job.expires_at,
        resultUrl: job.result_url,
        resultB64: job.result_b64,
        errorCode: job.error_code,
        errorMessage: job.error_message_safe,
      },
      queue: snapshot,
    });
  } catch {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 });
  }
}
