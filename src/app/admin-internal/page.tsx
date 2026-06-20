import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import AdminConsole from '@/components/AdminConsole';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { adminPayloadFromRuntime, getAdminBootstrapConfig, getRuntimeSettings } from '@/lib/settings';

export const metadata = {
  title: 'Aivro 管理后台',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage() {
  const config = getAdminBootstrapConfig();
  const headersList = await headers();
  const originalPath = headersList.get('x-admin-original-path') || headersList.get('x-pathname') || '';

  if (!config.enabled || originalPath !== config.adminPath) {
    notFound();
  }

  const authenticated = await isAdminAuthenticated();
  const initialSettings = authenticated ? adminPayloadFromRuntime(await getRuntimeSettings()) : null;

  return <AdminConsole configured={config.configured} initialAuthenticated={authenticated} initialSettings={initialSettings} />;
}
