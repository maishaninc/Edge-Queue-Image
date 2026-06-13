import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyCaptcha } from '../src/lib/captcha';

test('captcha verifier returns missing token and missing secret separately', async () => {
  const previousProvider = process.env.CAPTCHA_PROVIDER;
  const previousSecret = process.env.TURNSTILE_SECRET_KEY;

  process.env.CAPTCHA_PROVIDER = 'turnstile';
  process.env.TURNSTILE_SECRET_KEY = '';

  assert.deepEqual(await verifyCaptcha('', '127.0.0.1'), {
    ok: false,
    error: 'captcha_missing',
  });

  assert.deepEqual(await verifyCaptcha('token', '127.0.0.1'), {
    ok: false,
    error: 'captcha_secret_missing',
  });

  if (previousProvider === undefined) {
    delete process.env.CAPTCHA_PROVIDER;
  } else {
    process.env.CAPTCHA_PROVIDER = previousProvider;
  }

  if (previousSecret === undefined) {
    delete process.env.TURNSTILE_SECRET_KEY;
  } else {
    process.env.TURNSTILE_SECRET_KEY = previousSecret;
  }
});
