"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "antd";
import { ArrowRight } from "lucide-react";

import { AivroReveal } from "@/components/aivro-reveal";
import { AppHeader } from "@/components/app-header";
import { useI18n } from "@/hooks/use-i18n";
import { useAuthModal } from "@/stores/use-auth-modal";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

export default function HomePage() {
  const router = useRouter();
  const { locale } = useI18n();
  const publicSettings = useConfigStore((state) => state.publicSettings);
  const user = useUserStore((state) => state.user);
  const openLogin = useAuthModal((state) => state.setOpen);

  const home = publicSettings?.home;
  const siteName = publicSettings?.site?.name || "Aivro";

  useEffect(() => {
    // If the landing page is disabled, go straight to the studio (or its countdown).
    if (publicSettings && home && home.landingEnabled === false) {
      router.replace(home.countdownEnabled ? "/go" : "/image");
    }
  }, [publicSettings, home, router]);

  const go = () => {
    if (!user) {
      openLogin(true);
      return;
    }
    router.push(home?.countdownEnabled ? "/go" : "/image");
  };

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <AppHeader />
      <main className="aivro-wire-surface grid flex-1 place-items-center overflow-y-auto px-6">
        <AivroReveal className="text-center">
          <div data-aivro-reveal className="mb-6 flex items-center justify-center gap-3">
            <span
              className="block size-12 bg-foreground"
              style={{ mask: "url(/logo.svg) center / contain no-repeat", WebkitMask: "url(/logo.svg) center / contain no-repeat" }}
              aria-hidden="true"
            />
            <span className="text-5xl font-semibold">{siteName}</span>
          </div>
          <h1 data-aivro-reveal className="text-3xl font-bold sm:text-4xl">
            {locale === "en-US" ? "Free AI Image Generator" : "免费 AI 图片生成"}
          </h1>
          <p data-aivro-reveal className="mx-auto mt-4 max-w-xl text-muted-foreground">
            {locale === "en-US"
              ? "Describe anything and turn it into an image in seconds."
              : "输入一句描述，几秒生成你想要的画面。"}
          </p>
          <div data-aivro-reveal className="mt-8">
            <Button
              type="primary"
              size="large"
              className="!h-12 !px-8 !text-base"
              icon={<ArrowRight className="size-4" />}
              iconPosition="end"
              onClick={go}
            >
              {locale === "en-US" ? "Start generating" : "前往生成"}
            </Button>
          </div>
        </AivroReveal>
      </main>
    </div>
  );
}
