import { getCaptchaProvider } from './config';

export type CaptchaResult = {
  ok: boolean;
  error?: string;
};

async function verifyFormEndpoint(url: string, secret: string, token: string, remoteIp?: string): Promise<CaptchaResult> {
  if (!secret || !token) {
    return { ok: false, error: 'captcha_missing' };
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteIp && remoteIp !== 'unknown') {
    body.set('remoteip', remoteIp);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    return { ok: false, error: 'captcha_unreachable' };
  }

  const data = (await response.json()) as { success?: boolean };
  return data.success ? { ok: true } : { ok: false, error: 'captcha_failed' };
}

export async function verifyCaptcha(token: string | undefined, remoteIp?: string): Promise<CaptchaResult> {
  const provider = getCaptchaProvider();
  if (provider === 'none') return { ok: true };

  if (provider === 'turnstile') {
    return verifyFormEndpoint(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      process.env.TURNSTILE_SECRET_KEY || '',
      token || '',
      remoteIp,
    );
  }

  return verifyFormEndpoint(
    'https://hcaptcha.com/siteverify',
    process.env.HCAPTCHA_SECRET_KEY || '',
    token || '',
    remoteIp,
  );
}
