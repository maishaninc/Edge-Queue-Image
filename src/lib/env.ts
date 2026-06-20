export function integerFromEnv(name: string, fallback: number, min = 0) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

export function booleanFromEnv(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export function getTursoConfig() {
  return {
    url: process.env.TURSO_DATABASE_URL || '',
    authToken: process.env.TURSO_AUTH_TOKEN || '',
  };
}

export function isDatabaseConfigured() {
  const { url, authToken } = getTursoConfig();
  if (!url) return false;
  if (url.startsWith('file:')) return true;
  return Boolean(authToken);
}
