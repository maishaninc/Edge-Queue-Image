import { NextResponse, type NextRequest } from 'next/server';
import { getPublicRuntimeConfigAsync } from '@/lib/config';
import { cleanupExpiredJobs, getPriorityRemaining } from '@/lib/queue';
import { getClientIp, hashIpAsync } from '@/lib/request';

export async function GET(request: NextRequest) {
  const config = await getPublicRuntimeConfigAsync();
  let priorityRemaining = 0;

  if (config.priorityQueueEnabled) {
    try {
      await cleanupExpiredJobs();
      priorityRemaining = await getPriorityRemaining(await hashIpAsync(getClientIp(request)));
    } catch {
      priorityRemaining = 0;
    }
  }

  return NextResponse.json({ ...config, priorityRemaining });
}
