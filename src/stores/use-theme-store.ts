"use client";

import { create } from "zustand";

export type ThemeName = "light" | "dark";

const STORAGE_KEY = "eqi-theme";

type ThemeStore = {
  theme: ThemeName;
  setTheme: (theme: ThemeName, persist?: boolean) => void;
};

export const useThemeStore = create<ThemeStore>()((set) => ({
  theme: "dark",
  setTheme: (theme, persist = true) => {
    set({ theme });
    if (persist && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // ignore storage failures (private mode, etc.)
      }
    }
  },
}));

export function readStoredTheme(): ThemeName | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : undefined;
  } catch {
    return undefined;
  }
}
