/**
 * Default app settings + shared types.
 *
 * Settings live in the `app_settings` table as two JSON rows: `public` (safe to
 * expose to the browser) and `private` (secrets: OAuth client secrets, model API
 * keys, captcha secret keys). Admins edit everything at runtime — so deploying
 * only needs the 2 database env vars.
 */

export type CaptchaProvider = "none" | "turnstile" | "hcaptcha";

export type ModelChannel = {
  protocol: "openai";
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  weight: number;
  enabled: boolean;
  remark: string;
};

export type PublicAuthProvider = {
  enabled: boolean;
  name: string;
  iconUrl: string;
};

export type PublicSettings = {
  site: { name: string };
  access: { imageLoginRequired: boolean; allowRegister: boolean };
  models: {
    availableModels: string[];
    defaultImageModel: string;
    qualities: string[];
    sizes: string[];
  };
  captcha: { provider: CaptchaProvider; siteKey: string };
  auth: { google: PublicAuthProvider; github: PublicAuthProvider };
  adSense: {
    enabled: boolean;
    code: string;
    adsTxt: string;
    pages: { home: boolean; image: boolean; login: boolean };
  };
};

export type PrivateOAuthProvider = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
};

export type PrivateSettings = {
  runtime: { appOrigin: string; sessionExpireHours: number };
  imageRetentionDays: number;
  queue: { activeLimit: number; maxQueue: number; dailyLimit: number };
  channels: ModelChannel[];
  captcha: { provider: CaptchaProvider; siteKey: string; secretKey: string };
  auth: { google: PrivateOAuthProvider; github: PrivateOAuthProvider };
};

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  site: { name: "Aivro" },
  access: { imageLoginRequired: true, allowRegister: false },
  models: {
    availableModels: ["gpt-image-1"],
    defaultImageModel: "gpt-image-1",
    qualities: ["auto", "low", "medium", "high"],
    sizes: ["1024x1024", "1024x1536", "1536x1024"],
  },
  captcha: { provider: "none", siteKey: "" },
  auth: {
    google: { enabled: false, name: "Google", iconUrl: "" },
    github: { enabled: false, name: "GitHub", iconUrl: "" },
  },
  adSense: {
    enabled: false,
    code: "",
    adsTxt: "",
    pages: { home: true, image: true, login: false },
  },
};

export const DEFAULT_PRIVATE_SETTINGS: PrivateSettings = {
  runtime: { appOrigin: "", sessionExpireHours: 168 },
  imageRetentionDays: 7,
  queue: { activeLimit: 2, maxQueue: 20, dailyLimit: 0 },
  channels: [],
  captcha: { provider: "none", siteKey: "", secretKey: "" },
  auth: {
    google: {
      enabled: false,
      clientId: "",
      clientSecret: "",
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
      scope: "openid email profile",
    },
    github: {
      enabled: false,
      clientId: "",
      clientSecret: "",
      authorizeUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      userInfoUrl: "https://api.github.com/user",
      scope: "read:user user:email",
    },
  },
};

type Plain = Record<string, unknown>;
function isPlainObject(value: unknown): value is Plain {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep-merge `override` onto `base` (arrays are replaced, not merged). */
export function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined ? base : (override as T));
  }
  const result: Plain = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = (base as Plain)[key];
    result[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return result as T;
}
