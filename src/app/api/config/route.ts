import { NextResponse, type NextRequest } from 'next/server';
import { getPublicRuntimeConfig } from '@/lib/config';
import { getPriorityRemaining } from '@/lib/queue';
import { getClientIp, hashIp } from '@/lib/request';

export async function GET(request: NextRequest) {
  const config = getPublicRuntimeConfig();
  let priorityRemaining = 0;

  if (config.priorityQueueEnabled) {
    try {
      priorityRemaining = await getPriorityRemaining(hashIp(getClientIp(request)));
    } catch {
      priorityRemaining = 0;
    }
  }

  return NextResponse.json({ ...config, priorityRemaining });
}
