import { NextResponse, type NextRequest } from 'next/server';
import { getAdminCsrfToken, isAdminAuthenticated, verifyAdminCsrfToken } from '@/lib/admin-auth';
import {
  adminPayloadForClient,
  getAdminBootstrapConfig,
  getRuntimeSettings,
  mergeAdminSettingsWithExisting,
  saveAdminSettings,
  validateAdminSettings,
} from '@/lib/settings';

async function guardAdmin() {
  const config = getAdminBootstrapConfig();
  if (!config.enabled) {
    return NextResponse.json({ error: 'admin_disabled' }, { status: 404 });
  }
  if (!config.configured) {
    return NextResponse.json({ error: 'admin_not_configured' }, { status: 503 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const blocked = await guardAdmin();
  if (blocked) return blocked;

  const settings = await getRuntimeSettings();
  return NextResponse.json({ settings: adminPayloadForClient(settings, await getAdminCsrfToken()) });
}

export async function PUT(request: NextRequest) {
  const blocked = await guardAdmin();
  if (blocked) return blocked;
  if (!(await verifyAdminCsrfToken(request.headers.get('x-admin-csrf')))) {
    return NextResponse.json({ error: 'csrf_invalid' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const existing = await getRuntimeSettings();
  const bodyWithSecrets = mergeAdminSettingsWithExisting(body || {}, existing);
  const validated = validateAdminSettings(bodyWithSecrets);
  if (!validated.ok) {
    return NextResponse.json({ error: 'invalid_settings', errors: validated.errors }, { status: 400 });
  }

  await saveAdminSettings(validated.settings);
  return NextResponse.json({ ok: true, settings: adminPayloadForClient(validated.settings, await getAdminCsrfToken()) });
}
