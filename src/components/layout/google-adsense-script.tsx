"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

import { useConfigStore } from "@/stores/use-config-store";

function extractSrc(code: string): string | null {
  const match = /src="([^"]+)"/.exec(code);
  const src = match?.[1];
  return src && /^https?:\/\//.test(src) ? src : null;
}

function isPageAllowed(pathname: string | null, pages: { home: boolean; image: boolean; login: boolean }): boolean {
  if (!pathname) return false;
  if (pathname === "/") return pages.home;
  if (pathname.startsWith("/go")) return true;
  if (pathname.startsWith("/image")) return pages.image;
  if (pathname.startsWith("/login")) return pages.login;
  return false;
}

/** Injects the Google AdSense loader script on pages enabled in admin settings. */
export function GoogleAdSenseScript() {
  const pathname = usePathname();
  const adSense = useConfigStore((state) => state.publicSettings?.adSense);

  if (!adSense?.enabled || !adSense.code) return null;
  if (!isPageAllowed(pathname, adSense.pages)) return null;

  const src = extractSrc(adSense.code);
  if (!src) return null;

  return <Script async src={src} crossOrigin="anonymous" strategy="afterInteractive" />;
}
