import test from 'node:test';
import assert from 'node:assert/strict';
import { adminPayloadForClient, buildRuntimeSettings, mergeAdminSettingsWithExisting, parseModelsJson, validateAdminSettings } from '../src/lib/settings';

test('builds runtime settings from database values before environment fallback', () => {
  const settings = buildRuntimeSettings(
    {
      models_json: JSON.stringify([{ id: 'default', name: 'db-model', api: 'https://db.example.com/', key: 'db-key' }]),
      queue_concurrency: '1',
      captcha_provider: 'turnstile',
      turnstile_site_key: 'db-site',
      turnstile_secret_key: 'db-secret',
      ip_hash_salt: 'db-salt',
    },
    {
      MODEL: 'env-model',
      KEY: 'env-key',
      API: 'https://env.example.com',
      QUEUE_CONCURRENCY: '9',
      CAPTCHA_PROVIDER: 'none',
      IP_HASH_SALT: 'env-salt',
    },
  );

  assert.deepEqual(settings.models, [{ id: 'default', name: 'db-model', api: 'https://db.example.com', key: 'db-key' }]);
  assert.equal(settings.queue.concurrency, 1);
  assert.equal(settings.captcha.provider, 'turnstile');
  assert.equal(settings.captcha.turnstileSiteKey, 'db-site');
  assert.equal(settings.ipHashSalt, 'db-salt');
});

test('falls back to environment models when database model json is invalid', () => {
  const models = parseModelsJson('not-json', [{ id: 'default', name: 'env-model', api: 'https://env.example.com', key: 'env-key' }]);

  assert.deepEqual(models, [{ id: 'default', name: 'env-model', api: 'https://env.example.com', key: 'env-key' }]);
});

test('validates admin settings before save', () => {
  const invalid = validateAdminSettings({
    models: [{ name: '', api: '', key: '' }],
    queue: {
      concurrency: 0,
      maxWaiting: -1,
      pollIntervalMs: 100,
      runningJobTimeoutSeconds: 1,
      priorityQueueEnabled: true,
      priorityDailyLimit: -1,
      jobResultTtlMinutes: 0,
    },
    captcha: { provider: 'turnstile', turnstileSiteKey: '', turnstileSecretKey: '' },
  });

  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.errors['models.0.name'], 'Model name is required.');
    assert.equal(invalid.errors['queue.concurrency'], 'Must be at least 1.');
    assert.equal(invalid.errors['captcha.turnstileSecretKey'], 'Turnstile secret key is required.');
  }

  const valid = validateAdminSettings({
    models: [{ name: 'gpt-image-1', api: 'https://api.openai.com/', key: 'key' }],
    queue: {
      concurrency: 1,
      maxWaiting: 200,
      pollIntervalMs: 3000,
      runningJobTimeoutSeconds: 300,
      priorityQueueEnabled: true,
      priorityDailyLimit: 1,
      jobResultTtlMinutes: 15,
    },
    captcha: { provider: 'none' },
    ipHashSalt: 'salt',
  });

  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.settings.models[0].api, 'https://api.openai.com');
  }
});

test('rejects unsafe provider API URLs', () => {
  const invalid = validateAdminSettings({
    models: [{ name: 'local-model', api: 'http://127.0.0.1:8080', key: 'key' }],
    queue: {
      concurrency: 1,
      maxWaiting: 200,
      pollIntervalMs: 3000,
      runningJobTimeoutSeconds: 300,
      priorityQueueEnabled: true,
      priorityDailyLimit: 1,
      jobResultTtlMinutes: 15,
    },
    captcha: { provider: 'none' },
  });

  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.errors['models.0.api'], 'API URL must use HTTPS.');
  }
});

test('masks admin secrets for client payload and preserves unchanged secrets', () => {
  const existing = {
    models: [{ id: 'default', name: 'gpt-image-1', api: 'https://api.openai.com', key: 'sk-secret1234' }],
    queue: {
      concurrency: 1,
      maxWaiting: 200,
      pollIntervalMs: 3000,
      runningJobTimeoutSeconds: 300,
      priorityQueueEnabled: true,
      priorityDailyLimit: 1,
      jobResultTtlMinutes: 15,
    },
    captcha: {
      provider: 'turnstile' as const,
      turnstileSiteKey: 'site',
      turnstileSecretKey: 'turn-secret',
      hcaptchaSiteKey: '',
      hcaptchaSecretKey: '',
    },
    ipHashSalt: 'salt',
  };

  const clientPayload = adminPayloadForClient(existing);
  assert.equal(clientPayload.models[0].key, '••••1234');
  assert.equal(clientPayload.captcha.turnstileSecretKey, '••••cret');

  const merged = mergeAdminSettingsWithExisting(
    {
      ...existing,
      models: [{ ...existing.models[0], key: '••••1234' }],
      captcha: { ...existing.captcha, turnstileSecretKey: '••••cret' },
    },
    existing,
  );

  assert.equal(merged.models[0].key, 'sk-secret1234');
  assert.equal(merged.captcha.turnstileSecretKey, 'turn-secret');
});
