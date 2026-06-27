import "server-only";

import { query } from "@/lib/db";
import {
  DEFAULT_PRIVATE_SETTINGS,
  DEFAULT_PUBLIC_SETTINGS,
  deepMerge,
  type PrivateSettings,
  type PublicSettings,
} from "@/lib/settings-defaults";

type CacheEntry = { public?: PublicSettings; private?: PrivateSettings; ts: number };
const CACHE_TTL_MS = 5_000;
const cache: CacheEntry = { ts: 0 };

async function readRaw(key: "public" | "private"): Promise<Record<string, unknown>> {
  const result = await query<{ value: Record<string, unknown> }>(
    "SELECT value FROM app_settings WHERE key = $1",
    [key],
  );
  return result.rows[0]?.value ?? {};
}

export async function getPublicSettings(): Promise<PublicSettings> {
  if (cache.public && Date.now() - cache.ts < CACHE_TTL_MS) return cache.public;
  const raw = await readRaw("public");
  const merged = deepMerge(DEFAULT_PUBLIC_SETTINGS, raw);
  cache.public = merged;
  cache.ts = Date.now();
  return merged;
}

export async function getPrivateSettings(): Promise<PrivateSettings> {
  if (cache.private && Date.now() - cache.ts < CACHE_TTL_MS) return cache.private;
  const raw = await readRaw("private");
  const merged = deepMerge(DEFAULT_PRIVATE_SETTINGS, raw);
  cache.private = merged;
  cache.ts = Date.now();
  return merged;
}

export async function getSettings(): Promise<{ public: PublicSettings; private: PrivateSettings }> {
  const [pub, priv] = await Promise.all([getPublicSettings(), getPrivateSettings()]);
  return { public: pub, private: priv };
}

/**
 * Persist a partial settings update. Each provided side is deep-merged onto the
 * currently-stored value (not onto defaults), so unspecified keys are preserved.
 */
export async function saveSettings(update: {
  public?: Partial<PublicSettings> | Record<string, unknown>;
  private?: Partial<PrivateSettings> | Record<string, unknown>;
}): Promise<void> {
  if (update.public) {
    const current = await readRaw("public");
    const next = deepMerge(deepMerge(DEFAULT_PUBLIC_SETTINGS, current), update.public);
    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('public', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [JSON.stringify(next)],
    );
  }
  if (update.private) {
    const current = await readRaw("private");
    const next = deepMerge(deepMerge(DEFAULT_PRIVATE_SETTINGS, current), update.private);
    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('private', $1, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [JSON.stringify(next)],
    );
  }
  cache.public = undefined;
  cache.private = undefined;
  cache.ts = 0;
}

export type { PublicSettings, PrivateSettings };
