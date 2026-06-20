import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { getRuntimeSettings } from './settings';

export function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

export function hashIp(ip: string) {
  const salt = process.env.IP_HASH_SALT || 'aivro-edge-queue-image';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

export async function hashIpAsync(ip: string) {
  const { ipHashSalt } = await getRuntimeSettings();
  return createHash('sha256').update(`${ipHashSalt}:${ip}`).digest('hex');
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}
