export type CaptchaProvider = 'none' | 'turnstile' | 'hcaptcha';

export type PublicRuntimeConfig = {
  captchaProvider: CaptchaProvider;
  captchaSiteKey: string;
  priorityQueueEnabled: boolean;
  priorityDailyLimit: number;
  priorityRemaining: number;
  queuePollIntervalMs: number;
  jobResultTtlMinutes: number;
};

function integerFromEnv(name: string, fallback: number, min = 0) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

function booleanFromEnv(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export function getCaptchaProvider(): CaptchaProvider {
  const provider = (process.env.CAPTCHA_PROVIDER || 'none').toLowerCase();
  if (provider === 'turnstile' || provider === 'hcaptcha' || provider === 'none') {
    return provider;
  }
  return 'none';
}

export function getQueueConfig() {
  return {
    concurrency: integerFromEnv('QUEUE_CONCURRENCY', 50, 1),
    maxWaiting: integerFromEnv('QUEUE_MAX_WAITING', 200, 0),
    pollIntervalMs: integerFromEnv('QUEUE_POLL_INTERVAL_MS', 3000, 500),
    runningJobTimeoutSeconds: integerFromEnv('RUNNING_JOB_TIMEOUT_SECONDS', 300, 30),
    priorityQueueEnabled: booleanFromEnv('PRIORITY_QUEUE_ENABLED', true),
    priorityDailyLimit: integerFromEnv('PRIORITY_DAILY_LIMIT', 1, 0),
    jobResultTtlMinutes: integerFromEnv('JOB_RESULT_TTL_MINUTES', 15, 1),
  };
}

export function getPublicRuntimeConfig(): PublicRuntimeConfig {
  const captchaProvider = getCaptchaProvider();
  const captchaSiteKey =
    captchaProvider === 'turnstile'
      ? process.env.TURNSTILE_SITE_KEY || ''
      : captchaProvider === 'hcaptcha'
        ? process.env.HCAPTCHA_SITE_KEY || ''
        : '';
  const queue = getQueueConfig();

  return {
    captchaProvider,
    captchaSiteKey,
    priorityQueueEnabled: queue.priorityQueueEnabled,
    priorityDailyLimit: queue.priorityDailyLimit,
    priorityRemaining: 0,
    queuePollIntervalMs: queue.pollIntervalMs,
    jobResultTtlMinutes: queue.jobResultTtlMinutes,
  };
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
