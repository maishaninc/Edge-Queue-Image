import { getRuntimeSettings } from './settings';
import { booleanFromEnv, getTursoConfig, integerFromEnv, isDatabaseConfigured } from './env';

export type CaptchaProvider = 'none' | 'turnstile' | 'hcaptcha';

export type PublicRuntimeConfig = {
  captchaProvider: CaptchaProvider;
  captchaSiteKey: string;
  priorityQueueEnabled: boolean;
  priorityDailyLimit: number;
  priorityRemaining: number;
  queuePollIntervalMs: number;
  jobResultTtlMinutes: number;
  zhCnImageProxyEnabled: boolean;
};

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

export async function getQueueRuntimeConfig() {
  return (await getRuntimeSettings()).queue;
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
    zhCnImageProxyEnabled: false,
  };
}

export async function getPublicRuntimeConfigAsync(): Promise<PublicRuntimeConfig> {
  const settings = await getRuntimeSettings();
  const captchaProvider = settings.captcha.provider;
  const captchaSiteKey =
    captchaProvider === 'turnstile'
      ? settings.captcha.turnstileSiteKey
      : captchaProvider === 'hcaptcha'
        ? settings.captcha.hcaptchaSiteKey
        : '';

  return {
    captchaProvider,
    captchaSiteKey,
    priorityQueueEnabled: settings.queue.priorityQueueEnabled,
    priorityDailyLimit: settings.queue.priorityDailyLimit,
    priorityRemaining: 0,
    queuePollIntervalMs: settings.queue.pollIntervalMs,
    jobResultTtlMinutes: settings.queue.jobResultTtlMinutes,
    zhCnImageProxyEnabled: settings.zhCnImageProxyEnabled,
  };
}

export { getTursoConfig, integerFromEnv, isDatabaseConfigured };
