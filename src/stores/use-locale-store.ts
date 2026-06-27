"use client";

import { create } from "zustand";

import type { Locale } from "@/i18n/messages";

const STORAGE_KEY = "eqi-locale";

type LocaleStore = {
  locale: Locale;
  setLocale: (locale: Locale, persist?: boolean) => void;
};

export const useLocaleStore = create<LocaleStore>()((set) => ({
  // Constant default for SSR-safety; hydrated from storage / navigator on mount.
  locale: "zh-CN",
  setLocale: (locale, persist = true) => {
    set({ locale });
    if (persist && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, locale);
      } catch {
        // ignore
      }
    }
  },
}));

export function detectLocale(): Locale {
  if (typeof window === "undefined") return "zh-CN";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "zh-CN" || stored === "en-US") return stored;
    const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
    const language = languages.find(Boolean)?.toLowerCase() || "";
    return language.startsWith("zh") ? "zh-CN" : "en-US";
  } catch {
    return "zh-CN";
  }
}
