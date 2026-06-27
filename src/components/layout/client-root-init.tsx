"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { useAuthModal } from "@/stores/use-auth-modal";
import { useConfigStore } from "@/stores/use-config-store";
import { detectLocale, useLocaleStore } from "@/stores/use-locale-store";
import { readStoredTheme, useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";

/**
 * Client bootstrap: hydrate theme/locale from storage, load public config, hydrate
 * the current user, and pop the login modal on protected pages when required.
 */
export function ClientRootInit({ children }: { children: ReactNode }) {
  const setTheme = useThemeStore((state) => state.setTheme);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const hydrate = useUserStore((state) => state.hydrate);
  const user = useUserStore((state) => state.user);
  const isReady = useUserStore((state) => state.isReady);
  const publicSettings = useConfigStore((state) => state.publicSettings);
  const loadPublic = useConfigStore((state) => state.loadPublic);
  const setAuthModal = useAuthModal((state) => state.setOpen);
  const pathname = usePathname();

  useEffect(() => {
    const storedTheme = readStoredTheme();
    if (storedTheme) setTheme(storedTheme, false);
    setLocale(detectLocale(), false);
    void hydrate();
    void loadPublic();
  }, [hydrate, loadPublic, setLocale, setTheme]);

  useEffect(() => {
    if (!isReady || !publicSettings || !pathname) return;
    const requiresLogin = publicSettings.access?.imageLoginRequired !== false;
    const onProtected = pathname.startsWith("/image") || pathname.startsWith("/go");
    if (onProtected && requiresLogin && !user) {
      setAuthModal(true);
    }
  }, [isReady, publicSettings, user, pathname, setAuthModal]);

  return <>{children}</>;
}
