import type { Client } from '@libsql/client';
import { ensureSchema, getDb } from './db';
import { isDatabaseConfigured } from './env';
import type { CaptchaProvider } from './config';
import type { ImageModelConfig } from './models';

export type RuntimeSettings = {
  models: ImageModelConfig[];
  queue: {
    concurrency: number;
    maxWaiting: number;
    pollIntervalMs: number;
    runningJobTimeoutSeconds: number;
    priorityQueueEnabled: boolean;
    priorityDailyLimit: number;
    jobResultTtlMinutes: number;
  };
  captcha: {
    provider: CaptchaProvider;
    turnstileSiteKey: string;
    turnstileSecretKey: string;
    hcaptchaSiteKey: string;
    hcaptchaSecretKey: string;
  };
  ipHashSalt: string;
  zhCnImageProxyEnabled: boolean;
};

export type AdminModelInput = {
  id?: string;
  name?: string;
  api?: string;
  key?: string;
  dailyLimit?: unknown;
};

export type AdminSettingsInput = {
  models?: AdminModelInput[];
  queue?: {
    concurrency?: unknown;
    maxWaiting?: unknown;
    pollIntervalMs?: unknown;
    runningJobTimeoutSeconds?: unknown;
    priorityQueueEnabled?: unknown;
    priorityDailyLimit?: unknown;
    jobResultTtlMinutes?: unknown;
  };
  captcha?: {
    provider?: unknown;
    turnstileSiteKey?: unknown;
    turnstileSecretKey?: unknown;
    hcaptchaSiteKey?: unknown;
    hcaptchaSecretKey?: unknown;
  };
  ipHashSalt?: unknown;
  zhCnImageProxyEnabled?: unknown;
};

export type AdminSettingsPayload = {
  models: ImageModelConfig[];
  queue: RuntimeSettings['queue'];
  captcha: RuntimeSettings['captcha'];
  ipHashSalt: string;
  zhCnImageProxyEnabled: boolean;
  csrfToken?: string;
};

export type SettingsValidationResult =
  | { ok: true; settings: AdminSettingsPayload }
  | { ok: false; errors: Record<string, string> };

const SETTINGS_KEYS = [
  'models_json',
  'queue_concurrency',
  'queue_max_waiting',
  'queue_poll_interval_ms',
  'running_job_timeout_seconds',
  'job_result_ttl_minutes',
  'priority_queue_enabled',
  'priority_daily_limit',
  'captcha_provider',
  'turnstile_site_key',
  'turnstile_secret_key',
  'hcaptcha_site_key',
  'hcaptcha_secret_key',
  'ip_hash_salt',
  'zh_cn_image_proxy_enabled',
] as const;

type SettingsKey = (typeof SETTINGS_KEYS)[number];
type RawSettings = Partial<Record<SettingsKey, string>>;

function normalizedAdminPath(path = process.env.ADMIN_PATH || '') {
  const trimmed = path.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed.replace(/\/+$/, '') || '/' : `/${trimmed.replace(/\/+$/, '')}`;
}

export function getAdminBootstrapConfig() {
  const adminPath = normalizedAdminPath();
  return {
    adminPath,
    enabled: Boolean(adminPath),
    configured: Boolean(adminPath && process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET),
    password: process.env.ADMIN_PASSWORD || '',
    sessionSecret: process.env.ADMIN_SESSION_SECRET || '',
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number, min: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function integerFromRecord(env: NodeJS.ProcessEnv, name: string, fallback: number, min = 0) {
  const raw = env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

function booleanFromRecord(env: NodeJS.ProcessEnv, name: string, fallback: boolean) {
  const raw = env[name];
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function parseCaptchaProvider(value: string | undefined, fallback: CaptchaProvider): CaptchaProvider {
  const provider = (value || '').toLowerCase();
  if (provider === 'turnstile' || provider === 'hcaptcha' || provider === 'none') {
    return provider;
  }
  return fallback;
}

function envModels(env: NodeJS.ProcessEnv = process.env): ImageModelConfig[] {
  const models: ImageModelConfig[] = [];
  const addModel = (id: string, name?: string, key?: string, api?: string) => {
    if (!name?.trim() || !key?.trim() || !api?.trim()) return;
    models.push({
      id,
      name: name.trim(),
      key: key.trim(),
      api: api.trim().replace(/\/+$/, ''),
    });
  };

  addModel('default', env.MODEL, env.KEY, env.API);
  for (let index = 1; index <= 50; index += 1) {
    addModel(String(index), env[`MODEL_${index}`], env[`KEY_${index}`], env[`API_${index}`]);
  }
  return models;
}

export function parseModelsJson(value: string | undefined, fallback: ImageModelConfig[]) {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value) as AdminModelInput[];
    if (!Array.isArray(parsed)) return fallback;

    const models = parsed
      .map((model, index) => {
        const dailyLimit = Number.parseInt(String(model.dailyLimit ?? ''), 10);
        return {
          id: String(model.id || (index === 0 ? 'default' : index)),
          name: String(model.name || '').trim(),
          key: String(model.key || '').trim(),
          api: String(model.api || '')
            .trim()
            .replace(/\/+$/, ''),
          ...(Number.isFinite(dailyLimit) && dailyLimit >= 0 ? { dailyLimit } : {}),
        };
      })
      .filter((model) => model.name && model.key && model.api);

    return models.length ? models : fallback;
  } catch {
    return fallback;
  }
}

export function buildRuntimeSettings(raw: RawSettings = {}, env: NodeJS.ProcessEnv = process.env): RuntimeSettings {
  const fallbackModels = envModels(env);
  const envProvider = parseCaptchaProvider(env.CAPTCHA_PROVIDER, 'none');

  return {
    models: parseModelsJson(raw.models_json, fallbackModels),
    queue: {
      concurrency: parsePositiveInteger(raw.queue_concurrency, integerFromRecord(env, 'QUEUE_CONCURRENCY', 50, 1), 1),
      maxWaiting: parsePositiveInteger(raw.queue_max_waiting, integerFromRecord(env, 'QUEUE_MAX_WAITING', 200, 0), 0),
      pollIntervalMs: parsePositiveInteger(raw.queue_poll_interval_ms, integerFromRecord(env, 'QUEUE_POLL_INTERVAL_MS', 3000, 500), 500),
      runningJobTimeoutSeconds: parsePositiveInteger(
        raw.running_job_timeout_seconds,
        integerFromRecord(env, 'RUNNING_JOB_TIMEOUT_SECONDS', 300, 30),
        30,
      ),
      priorityQueueEnabled: parseBoolean(raw.priority_queue_enabled, booleanFromRecord(env, 'PRIORITY_QUEUE_ENABLED', true)),
      priorityDailyLimit: parsePositiveInteger(raw.priority_daily_limit, integerFromRecord(env, 'PRIORITY_DAILY_LIMIT', 1, 0), 0),
      jobResultTtlMinutes: parsePositiveInteger(raw.job_result_ttl_minutes, integerFromRecord(env, 'JOB_RESULT_TTL_MINUTES', 15, 1), 1),
    },
    captcha: {
      provider: parseCaptchaProvider(raw.captcha_provider, envProvider),
      turnstileSiteKey: raw.turnstile_site_key || env.TURNSTILE_SITE_KEY || '',
      turnstileSecretKey: raw.turnstile_secret_key || env.TURNSTILE_SECRET_KEY || '',
      hcaptchaSiteKey: raw.hcaptcha_site_key || env.HCAPTCHA_SITE_KEY || '',
      hcaptchaSecretKey: raw.hcaptcha_secret_key || env.HCAPTCHA_SECRET_KEY || '',
    },
    ipHashSalt: raw.ip_hash_salt || env.IP_HASH_SALT || 'aivro-edge-queue-image',
    zhCnImageProxyEnabled: parseBoolean(raw.zh_cn_image_proxy_enabled, booleanFromRecord(env, 'ZH_CN_IMAGE_PROXY_ENABLED', false)),
  };
}

export async function readRawSettings(db?: Client): Promise<RawSettings> {
  if (!isDatabaseConfigured()) return {};
  const client = db || getDb();
  await ensureSchema(client);
  const result = await client.execute({
    sql: `SELECT key, value FROM app_settings WHERE key IN (${SETTINGS_KEYS.map(() => '?').join(',')})`,
    args: [...SETTINGS_KEYS],
  });

  const settings: RawSettings = {};
  for (const row of result.rows) {
    const key = String(row.key) as SettingsKey;
    if ((SETTINGS_KEYS as readonly string[]).includes(key)) {
      settings[key] = String(row.value);
    }
  }
  return settings;
}

export async function getRuntimeSettings(db?: Client) {
  if (!isDatabaseConfigured()) return buildRuntimeSettings();
  try {
    const raw = await readRawSettings(db);
    return buildRuntimeSettings(raw);
  } catch {
    return buildRuntimeSettings();
  }
}

function fieldString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function maskSecret(value: string) {
  if (!value) return '';
  return `••••${value.slice(-4)}`;
}

function isMaskedSecret(value: string) {
  return value.startsWith('••••');
}

function normalizeHttpsApiUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      return { ok: false as const, error: 'API URL must use HTTPS.' };
    }
    return { ok: true as const, value: url.toString().replace(/\/+$/, '') };
  } catch {
    return { ok: false as const, error: 'API URL is invalid.' };
  }
}

function fieldInteger(value: unknown, field: string, min: number, errors: Record<string, string>) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < min) {
    errors[field] = `Must be at least ${min}.`;
    return min;
  }
  return parsed;
}

export function validateAdminSettings(input: AdminSettingsInput): SettingsValidationResult {
  const errors: Record<string, string> = {};
  const modelsInput = Array.isArray(input.models) ? input.models : [];
  const models = modelsInput.map((model, index) => {
    const name = fieldString(model.name);
    const rawApi = fieldString(model.api).replace(/\/+$/, '');
    const normalizedApi = rawApi ? normalizeHttpsApiUrl(rawApi) : null;
    const api = normalizedApi?.ok ? normalizedApi.value : rawApi;
    const key = fieldString(model.key);
    if (!name) errors[`models.${index}.name`] = 'Model name is required.';
    if (!rawApi) {
      errors[`models.${index}.api`] = 'API URL is required.';
    } else if (normalizedApi && !normalizedApi.ok) {
      errors[`models.${index}.api`] = normalizedApi.error;
    }
    if (!key) errors[`models.${index}.key`] = 'API key is required.';
    const dailyLimitRaw = Number.parseInt(String((model as AdminModelInput).dailyLimit ?? ''), 10);
    const dailyLimit = Number.isFinite(dailyLimitRaw) && dailyLimitRaw >= 0 ? dailyLimitRaw : 0;
    return {
      id: String(model.id || (index === 0 ? 'default' : index)),
      name,
      api,
      key,
      ...(dailyLimit > 0 ? { dailyLimit } : {}),
    };
  });

  if (!models.length) {
    errors.models = 'At least one model is required.';
  }

  const queue = input.queue || {};
  const captcha = input.captcha || {};
  const providerRaw = fieldString(captcha.provider);
  const provider = parseCaptchaProvider(providerRaw, 'none');
  if (providerRaw && !['none', 'turnstile', 'hcaptcha'].includes(providerRaw)) {
    errors['captcha.provider'] = 'Captcha provider is invalid.';
  }
  const turnstileSiteKey = fieldString(captcha.turnstileSiteKey);
  const turnstileSecretKey = fieldString(captcha.turnstileSecretKey);
  const hcaptchaSiteKey = fieldString(captcha.hcaptchaSiteKey);
  const hcaptchaSecretKey = fieldString(captcha.hcaptchaSecretKey);

  if (provider === 'turnstile') {
    if (!turnstileSiteKey) errors['captcha.turnstileSiteKey'] = 'Turnstile site key is required.';
    if (!turnstileSecretKey) errors['captcha.turnstileSecretKey'] = 'Turnstile secret key is required.';
  }
  if (provider === 'hcaptcha') {
    if (!hcaptchaSiteKey) errors['captcha.hcaptchaSiteKey'] = 'hCaptcha site key is required.';
    if (!hcaptchaSecretKey) errors['captcha.hcaptchaSecretKey'] = 'hCaptcha secret key is required.';
  }

  const priorityQueueEnabled = Boolean(queue.priorityQueueEnabled);
  const settings: AdminSettingsPayload = {
    models,
    queue: {
      concurrency: fieldInteger(queue.concurrency, 'queue.concurrency', 1, errors),
      maxWaiting: fieldInteger(queue.maxWaiting, 'queue.maxWaiting', 0, errors),
      pollIntervalMs: fieldInteger(queue.pollIntervalMs, 'queue.pollIntervalMs', 500, errors),
      runningJobTimeoutSeconds: fieldInteger(queue.runningJobTimeoutSeconds, 'queue.runningJobTimeoutSeconds', 30, errors),
      priorityQueueEnabled,
      priorityDailyLimit: fieldInteger(queue.priorityDailyLimit, 'queue.priorityDailyLimit', 0, errors),
      jobResultTtlMinutes: fieldInteger(queue.jobResultTtlMinutes, 'queue.jobResultTtlMinutes', 1, errors),
    },
    captcha: {
      provider,
      turnstileSiteKey,
      turnstileSecretKey,
      hcaptchaSiteKey,
      hcaptchaSecretKey,
    },
    ipHashSalt: fieldString(input.ipHashSalt) || 'aivro-edge-queue-image',
    zhCnImageProxyEnabled: Boolean(input.zhCnImageProxyEnabled),
  };

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, settings };
}

export async function saveAdminSettings(settings: AdminSettingsPayload, db: Client = getDb()) {
  await ensureSchema(db);
  const values: RawSettings = {
    models_json: JSON.stringify(settings.models),
    queue_concurrency: String(settings.queue.concurrency),
    queue_max_waiting: String(settings.queue.maxWaiting),
    queue_poll_interval_ms: String(settings.queue.pollIntervalMs),
    running_job_timeout_seconds: String(settings.queue.runningJobTimeoutSeconds),
    job_result_ttl_minutes: String(settings.queue.jobResultTtlMinutes),
    priority_queue_enabled: settings.queue.priorityQueueEnabled ? 'true' : 'false',
    priority_daily_limit: String(settings.queue.priorityDailyLimit),
    captcha_provider: settings.captcha.provider,
    turnstile_site_key: settings.captcha.turnstileSiteKey,
    turnstile_secret_key: settings.captcha.turnstileSecretKey,
    hcaptcha_site_key: settings.captcha.hcaptchaSiteKey,
    hcaptcha_secret_key: settings.captcha.hcaptchaSecretKey,
    ip_hash_salt: settings.ipHashSalt,
    zh_cn_image_proxy_enabled: settings.zhCnImageProxyEnabled ? 'true' : 'false',
  };
  const now = new Date().toISOString();

  await db.batch(
    Object.entries(values).map(([key, value]) => ({
      sql: `INSERT INTO app_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [key, value, now],
    })),
    'write',
  );
}

export function adminPayloadFromRuntime(settings: RuntimeSettings): AdminSettingsPayload {
  return {
    models: settings.models,
    queue: settings.queue,
    captcha: settings.captcha,
    ipHashSalt: settings.ipHashSalt,
    zhCnImageProxyEnabled: settings.zhCnImageProxyEnabled,
  };
}

export function adminPayloadForClient(settings: RuntimeSettings | AdminSettingsPayload, csrfToken?: string): AdminSettingsPayload {
  return {
    models: settings.models.map((model) => ({ ...model, key: maskSecret(model.key) })),
    queue: settings.queue,
    captcha: {
      ...settings.captcha,
      turnstileSecretKey: maskSecret(settings.captcha.turnstileSecretKey),
      hcaptchaSecretKey: maskSecret(settings.captcha.hcaptchaSecretKey),
    },
    ipHashSalt: settings.ipHashSalt,
    zhCnImageProxyEnabled: settings.zhCnImageProxyEnabled,
    csrfToken,
  };
}

export function mergeAdminSettingsWithExisting(settings: AdminSettingsPayload, existing: RuntimeSettings | AdminSettingsPayload): AdminSettingsPayload {
  return {
    ...settings,
    models: settings.models.map((model, index) => {
      const existingModel = existing.models[index];
      return {
        ...model,
        key: isMaskedSecret(model.key) && existingModel ? existingModel.key : model.key,
      };
    }),
    captcha: {
      ...settings.captcha,
      turnstileSecretKey:
        isMaskedSecret(settings.captcha.turnstileSecretKey) && existing.captcha.turnstileSecretKey
          ? existing.captcha.turnstileSecretKey
          : settings.captcha.turnstileSecretKey,
      hcaptchaSecretKey:
        isMaskedSecret(settings.captcha.hcaptchaSecretKey) && existing.captcha.hcaptchaSecretKey
          ? existing.captcha.hcaptchaSecretKey
          : settings.captcha.hcaptchaSecretKey,
    },
  };
}
