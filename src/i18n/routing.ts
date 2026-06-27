import type { Locale } from "@/i18n/messages";

export const locales = ["zh-CN", "en-US"] as const satisfies readonly Locale[];
export const defaultLocale: Locale = "zh-CN";

export function isLocale(value: string | undefined): value is Locale {
  return value === "zh-CN" || value === "en-US";
}

export function preferredLocale(acceptLanguage: string | null): Locale {
  const first = (acceptLanguage || "").split(",").find(Boolean)?.trim().toLowerCase() || "";
  return first.startsWith("zh") ? "zh-CN" : "en-US";
}
