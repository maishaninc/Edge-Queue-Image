"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "antd";

import { AdSlot, extractAdClient } from "@/components/ad-slot";
import { AppHeader } from "@/components/app-header";
import { useI18n } from "@/hooks/use-i18n";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

export default function CountdownPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const publicSettings = useConfigStore((state) => state.publicSettings);
  const user = useUserStore((state) => state.user);
  const isReady = useUserStore((state) => state.isReady);

  const home = publicSettings?.home;
  const adSense = publicSettings?.adSense;
  const seconds = Math.max(1, home?.countdownSeconds || 5);
  const [left, setLeft] = useState(seconds);

  const requiresLogin = publicSettings?.access?.imageLoginRequired !== false;
  const blocked = requiresLogin && !user;

  useEffect(() => {
    setLeft(seconds);
  }, [seconds]);

  useEffect(() => {
    if (blocked || !isReady) return;
    if (left <= 0) {
      router.replace("/image");
      return;
    }
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [left, blocked, isReady, router]);

  const showAds = Boolean(adSense?.enabled && home?.countdownAds);
  const client = showAds ? extractAdClient(adSense?.code) : "";
  const slot = home?.adSlot || "";

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <AppHeader />
      <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr_auto] gap-2 p-2 sm:p-4">
        {showAds ? <AdSlot client={client} slot={slot} className="h-20 w-full" label="顶部广告位" /> : null}
        <div className="grid min-h-0 grid-cols-[auto_1fr_auto] items-stretch gap-2">
          {showAds ? <AdSlot client={client} slot={slot} className="hidden w-40 lg:block" label="左侧广告位" /> : <div />}
          <div className="grid place-items-center text-center">
            {blocked ? (
              <p className="text-lg font-medium">{locale === "en-US" ? "Please sign in to continue" : "请登录后继续"}</p>
            ) : (
              <div className="space-y-4">
                <div className="text-7xl font-bold tabular-nums">{left}</div>
                <p className="text-muted-foreground">{locale === "en-US" ? "Entering the studio…" : "即将进入生图工作台…"}</p>
                <Button onClick={() => router.replace("/image")}>{locale === "en-US" ? "Skip" : "立即进入"}</Button>
              </div>
            )}
          </div>
          {showAds ? <AdSlot client={client} slot={slot} className="hidden w-40 lg:block" label="右侧广告位" /> : <div />}
        </div>
        {showAds ? <AdSlot client={client} slot={slot} className="h-20 w-full" label="底部广告位" /> : null}
      </div>
    </div>
  );
}
