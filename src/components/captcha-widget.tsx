"use client";

import { useEffect, useRef } from "react";

type CaptchaProvider = "none" | "turnstile" | "hcaptcha";

type CaptchaWidgetProps = {
  provider: CaptchaProvider;
  siteKey: string;
  onToken: (token: string) => void;
  /** Bump to force a fresh challenge (captcha tokens are single-use). */
  refreshKey?: number;
};

type CaptchaApi = {
  render: (el: HTMLElement, options: { sitekey: string; callback: (token: string) => void }) => unknown;
};

declare global {
  interface Window {
    turnstile?: CaptchaApi;
    hcaptcha?: CaptchaApi;
  }
}

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("captcha script failed"));
    document.head.appendChild(script);
  });
}

export function CaptchaWidget({ provider, siteKey, onToken, refreshKey }: CaptchaWidgetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (provider === "none" || !siteKey || !el) return;
    let cancelled = false;
    el.innerHTML = "";

    const src =
      provider === "turnstile"
        ? "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        : "https://js.hcaptcha.com/1/api.js?render=explicit";
    const scriptId = provider === "turnstile" ? "cf-turnstile-script" : "hcaptcha-script";

    void loadScript(src, scriptId)
      .then(() => {
        if (cancelled) return;
        const api = provider === "turnstile" ? window.turnstile : window.hcaptcha;
        if (!api) return;
        api.render(el, { sitekey: siteKey, callback: (token: string) => onToken(token) });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, siteKey, refreshKey]);

  if (provider === "none" || !siteKey) return null;
  return <div ref={ref} className="my-2" />;
}
