"use client";

import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { App, Button, Divider, Form, Input } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { AivroReveal } from "@/components/aivro-reveal";
import { useAuthLoadingOverlay } from "@/hooks/use-auth-loading-overlay";
import { useI18n } from "@/hooks/use-i18n";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/image";
  return value;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const { message } = App.useApp();
  const { locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form] = Form.useForm<{ username: string; password: string }>();
  const signInAdmin = useUserStore((state) => state.signInAdmin);
  const isLoading = useUserStore((state) => state.isLoading);
  const publicSettings = useConfigStore((state) => state.publicSettings);
  const loadPublic = useConfigStore((state) => state.loadPublic);
  const { overlay, runWithOverlay } = useAuthLoadingOverlay();

  const redirect = safeRedirect(searchParams.get("redirect"));
  const auth = publicSettings?.auth;
  const providers = [
    auth?.google?.enabled ? { id: "google", name: auth.google.name || "Google", iconUrl: auth.google.iconUrl } : null,
    auth?.github?.enabled ? { id: "github", name: auth.github.name || "GitHub", iconUrl: auth.github.iconUrl } : null,
  ].filter(Boolean) as Array<{ id: string; name: string; iconUrl: string }>;

  useEffect(() => {
    void loadPublic();
  }, [loadPublic]);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) message.error(error);
  }, [searchParams, message]);

  const submit = async (values: { username: string; password: string }) => {
    try {
      const user = await runWithOverlay(locale === "en-US" ? "Signing in" : "正在登录", () =>
        signInAdmin(values.username, values.password),
      );
      message.success(locale === "en-US" ? "Signed in" : "登录成功");
      router.replace(user.role === "admin" ? "/admin" : redirect);
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : locale === "en-US" ? "Sign in failed" : "登录失败");
    }
  };

  return (
    <main className="aivro-wire-surface flex h-full min-h-0 items-center justify-center overflow-y-auto bg-[#080808] px-5 py-8 text-stone-200">
      <AivroReveal className="w-full max-w-[444px]">
        <Form
          form={form}
          layout="vertical"
          size="large"
          requiredMark={false}
          onFinish={submit}
          className="aivro-auth-form"
        >
          <div data-aivro-reveal className="mb-10 flex items-center justify-center gap-3">
            <span
              className="block size-10 bg-stone-100"
              style={{
                mask: "url(/logo.svg) center / contain no-repeat",
                WebkitMask: "url(/logo.svg) center / contain no-repeat",
              }}
              aria-hidden="true"
            />
            <span className="text-4xl font-semibold leading-none tracking-normal text-stone-100">
              {publicSettings?.site?.name || "Aivro"}
            </span>
          </div>

          {providers.length ? (
            <div data-aivro-reveal className="grid gap-3">
              {providers.map((provider) => (
                <Button
                  key={provider.id}
                  className="h-12 justify-center text-base"
                  block
                  href={`/api/auth/oauth/${provider.id}/authorize?redirect=${encodeURIComponent(redirect)}`}
                  icon={
                    provider.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={provider.iconUrl} alt="" width={20} height={20} className="shrink-0" />
                    ) : undefined
                  }
                >
                  {locale === "en-US" ? `Sign in with ${provider.name}` : `使用 ${provider.name} 登录`}
                </Button>
              ))}
            </div>
          ) : null}

          {providers.length ? (
            <Divider plain className="!my-7 !border-stone-700 !text-stone-500">
              {locale === "en-US" ? "or admin sign in" : "或 管理员登录"}
            </Divider>
          ) : null}

          <AivroReveal>
            <div data-aivro-reveal className="aivro-auth-fields">
              <Form.Item
                name="username"
                label={<span className="font-medium text-stone-200">{locale === "en-US" ? "Username" : "用户名"}</span>}
                rules={[{ required: true, message: locale === "en-US" ? "Enter username" : "请输入用户名" }]}
              >
                <Input prefix={<UserOutlined />} autoComplete="username" />
              </Form.Item>
              <Form.Item
                name="password"
                label={<span className="font-medium text-stone-200">{locale === "en-US" ? "Password" : "密码"}</span>}
                rules={[{ required: true, message: locale === "en-US" ? "Enter password" : "请输入密码" }]}
              >
                <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
              </Form.Item>
            </div>
          </AivroReveal>

          <Button
            className="!mt-1 !h-14 !rounded-xl !border-0 !bg-stone-200 !text-lg !font-medium !text-stone-950 hover:!bg-white disabled:!bg-stone-500"
            block
            type="primary"
            htmlType="submit"
            loading={isLoading}
            disabled={!publicSettings}
          >
            {locale === "en-US" ? "Sign in" : "登录"}
          </Button>
          <p className="m-0 mt-4 px-1 text-center text-sm leading-6 text-stone-400">
            {locale === "en-US"
              ? "Regular users sign in with Google / GitHub."
              : "普通用户请使用 Google / GitHub 登录。"}
          </p>
        </Form>
      </AivroReveal>
      {overlay}
    </main>
  );
}
