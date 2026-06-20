import { NextResponse } from 'next/server';
import { clearAdminSessionCookie, verifyAdminCsrfToken } from '@/lib/admin-auth';
import { getAdminBootstrapConfig } from '@/lib/settings';

export async function POST(request: Request) {
  const config = getAdminBootstrapConfig();
  if (!config.enabled) {
    return NextResponse.json({ error: 'admin_disabled' }, { status: 404 });
  }
  if (!(await verifyAdminCsrfToken(request.headers.get('x-admin-csrf')))) {
    return NextResponse.json({ error: 'csrf_invalid' }, { status: 403 });
  }

  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
