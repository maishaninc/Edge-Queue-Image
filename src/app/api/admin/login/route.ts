import { NextResponse, type NextRequest } from 'next/server';
import { setAdminSessionCookie, verifyAdminPassword } from '@/lib/admin-auth';
import { getAdminBootstrapConfig } from '@/lib/settings';
import { getClientIp, hashIp } from '@/lib/request';
import { clearAdminLoginFailures, isAdminLoginLockedForIp, recordAdminLoginFailure } from '@/lib/security';

type LoginBody = {
  password?: string;
};

export async function POST(request: NextRequest) {
  const config = getAdminBootstrapConfig();
  if (!config.enabled) {
    return NextResponse.json({ error: 'admin_disabled' }, { status: 404 });
  }
  if (!config.configured) {
    return NextResponse.json({ error: 'admin_not_configured' }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const ipHash = hashIp(getClientIp(request));
  if (await isAdminLoginLockedForIp(ipHash)) {
    return NextResponse.json({ error: 'too_many_attempts' }, { status: 429 });
  }

  if (!verifyAdminPassword(body.password || '')) {
    await recordAdminLoginFailure(ipHash);
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 });
  }

  await clearAdminLoginFailures(ipHash);
  await setAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
