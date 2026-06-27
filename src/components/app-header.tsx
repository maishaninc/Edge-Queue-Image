"use client";

import { useRouter } from "next/navigation";
import { App, Avatar, Button, Dropdown } from "antd";
import { Coins, Languages, LogOut, Moon, Sun } from "lucide-react";

import { useI18n } from "@/hooks/use-i18n";
import { checkIn } from "@/services/api/auth";
import { useConfigStore } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { useUserStore } from "@/stores/use-user-store";

export function AppHeader() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const user = useUserStore((state) => state.user);
  const isReady = useUserStore((state) => state.isReady);
  const signOut = useUserStore((state) => state.signOut);
  const setUser = useUserStore((state) => state.setUser);
  const publicSettings = useConfigStore((state) => state.publicSettings);
  const { message } = App.useApp();

  const dark = theme === "dark";
  const checkInEnabled = Boolean(publicSettings?.checkIn?.enabled);

  const doCheckIn = async () => {
    try {
      const res = await checkIn();
      message.success(locale === "en-US" ? `Checked in +${res.gained}` : `签到成功 +${res.gained} 额度`);
      if (user) setUser({ ...user, credits: res.credits, checkedInToday: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : locale === "en-US" ? "Check-in failed" : "签到失败");
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span
          className="block size-7 bg-foreground"
          style={{
            mask: "url(/logo.svg) center / contain no-repeat",
            WebkitMask: "url(/logo.svg) center / contain no-repeat",
          }}
          aria-hidden="true"
        />
        <span className="text-lg font-semibold tracking-tight">{t("app.name")}</span>
        <span className="ml-1 hidden text-sm text-muted-foreground sm:inline">{t("nav.image")}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          type="text"
          aria-label={t("locale.switch")}
          icon={<Languages className="size-4" />}
          onClick={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}
        />
        <Button
          type="text"
          aria-label={dark ? t("theme.toLight") : t("theme.toDark")}
          icon={dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          onClick={() => setTheme(dark ? "light" : "dark")}
        />
        {user && checkInEnabled ? (
          <Button
            type={user.checkedInToday ? "text" : "primary"}
            size="small"
            icon={<Coins className="size-4" />}
            disabled={user.checkedInToday}
            onClick={() => void doCheckIn()}
          >
            {user.checkedInToday
              ? `${user.credits}${locale === "en-US" ? "" : " 额度"}`
              : locale === "en-US"
                ? "Check in"
                : "签到"}
          </Button>
        ) : null}
        {!isReady ? null : user ? (
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                ...(user.role === "admin"
                  ? [{ key: "admin", label: t("common.admin"), onClick: () => router.push("/admin") }]
                  : []),
                {
                  key: "logout",
                  label: t("common.logout"),
                  icon: <LogOut className="size-4" />,
                  onClick: async () => {
                    await signOut();
                    router.replace("/login");
                  },
                },
              ],
            }}
          >
            <button type="button" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-secondary">
              <Avatar size={28} src={user.avatarUrl || undefined}>
                {(user.displayName || user.username || "U").slice(0, 1).toUpperCase()}
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-sm sm:inline">{user.displayName}</span>
            </button>
          </Dropdown>
        ) : (
          <Button type="primary" onClick={() => router.push("/login")}>
            {t("common.login")}
          </Button>
        )}
      </div>
    </header>
  );
}
