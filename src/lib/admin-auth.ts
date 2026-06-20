import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { getAdminBootstrapConfig } from './settings';

export const ADMIN_SESSION_COOKIE = 'aivro_admin_session';
export const ADMIN_CSRF_COOKIE = 'aivro_admin_csrf';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}

export function verifyAdminPassword(password: string) {
  const config = getAdminBootstrapConfig();
  if (!config.configured) return false;
  return safeEqual(password, config.password);
}

export function createAdminSession(now = Date.now()) {
  const { sessionSecret } = getAdminBootstrapConfig();
  const payload = base64url(JSON.stringify({ iat: now }));
  return `${payload}.${sign(payload, sessionSecret)}`;
}

export function createCsrfToken() {
  return randomBytes(32).toString('base64url');
}

export function verifyAdminSession(token: string | undefined, now = Date.now()) {
  const config = getAdminBootstrapConfig();
  if (!config.configured || !token) return false;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  if (!safeEqual(sign(payload, config.sessionSecret), signature)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { iat?: number };
    if (!data.iat || now - data.iat > SESSION_TTL_SECONDS * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function setAdminSessionCookie() {
  const cookieStore = await cookies();
  const csrfToken = createCsrfToken();
  cookieStore.set(ADMIN_SESSION_COOKIE, createAdminSession(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  cookieStore.set(ADMIN_CSRF_COOKIE, csrfToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  cookieStore.set(ADMIN_CSRF_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function getAdminCsrfToken() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_CSRF_COOKIE)?.value || '';
}

export async function verifyAdminCsrfToken(token: string | null) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ADMIN_CSRF_COOKIE)?.value || '';
  if (!token || !cookieToken) return false;
  return safeEqual(token, cookieToken);
}
