"use client";

import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { App, Button, Divider, Form, Input, Modal } from "antd";
import { usePathname } from "next/navigation";

import { useI18n } from "@/hooks/use-i18n";
import { useAuthModal } from "@/stores/use-auth-modal";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

/** Global login popup: Google / GitHub OAuth + admin username/password. */
export function LoginModal() {
  const open = useAuthModal((state) => state.open);
  const setOpen = useAuthModal((state) => state.setOpen);
  const { message } = App.useApp();
  const { locale } = useI18n();
  const pathname = usePathname();
  const signInAdmin = useUserStore((state) => state.signInAdmin);
  const hydrate = useUserStore((state) => state.hydrate);
  const isLoading = useUserStore((state) => state.isLoading);
  const publicSettings = useConfigStore((state) => state.publicSettings);
  const [form] = Form.useForm<{ username: string; password: string }>();

  const auth = publicSettings?.auth;
  const providers = [
    auth?.google?.enabled ? { id: "google", name: auth.google.name || "Google", iconUrl: auth.google.iconUrl } : null,
    auth?.github?.enabled ? { id: "github", name: auth.github.name || "GitHub", iconUrl: auth.github.iconUrl } : null,
  ].filter(Boolean) as Array<{ id: string; name: string; iconUrl: string }>;
  const redirect = pathname && pathname.startsWith("/") ? pathname : "/image";

  const submit = async (values: { username: string; password: string }) => {
    try {
      await signInAdmin(values.username, values.password);
      message.success(locale === "en-US" ? "Signed in" : "登录成功");
      setOpen(false);
      await hydrate();
    } catch (error) {
      message.error(error instanceof Error ? error.message : locale === "en-US" ? "Sign in failed" : "登录失败");
    }
  };

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      title={locale === "en-US" ? "Sign in" : "登录"}
      width={400}
      centered
      destroyOnHidden
    >
      <div className="grid gap-3 pt-2">
        {providers.length ? (
          <div className="grid gap-2.5">
            {providers.map((provider) => (
              <Button
                key={provider.id}
                block
                className="h-11 justify-center"
                href={`/api/auth/oauth/${provider.id}/authorize?redirect=${encodeURIComponent(redirect)}`}
                icon={
                  provider.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={provider.iconUrl} alt="" width={18} height={18} />
                  ) : undefined
                }
              >
                {locale === "en-US" ? `Sign in with ${provider.name}` : `使用 ${provider.name} 登录`}
              </Button>
            ))}
            <Divider plain className="!my-2 text-xs text-muted-foreground">
              {locale === "en-US" ? "or admin" : "或 管理员登录"}
            </Divider>
          </div>
        ) : null}
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item
            name="username"
            label={locale === "en-US" ? "Username" : "用户名"}
            rules={[{ required: true, message: locale === "en-US" ? "Enter username" : "请输入用户名" }]}
          >
            <Input prefix={<UserOutlined />} autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="password"
            label={locale === "en-US" ? "Password" : "密码"}
            rules={[{ required: true, message: locale === "en-US" ? "Enter password" : "请输入密码" }]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={isLoading} disabled={!publicSettings}>
            {locale === "en-US" ? "Sign in" : "登录"}
          </Button>
        </Form>
        <p className="m-0 text-center text-xs text-muted-foreground">
          {locale === "en-US" ? "Regular users sign in with Google / GitHub." : "普通用户请使用 Google / GitHub 登录。"}
        </p>
      </div>
    </Modal>
  );
}
