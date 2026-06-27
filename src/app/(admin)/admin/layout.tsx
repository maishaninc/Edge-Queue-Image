"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { App, Button, Form, Input, Layout, Menu, Modal } from "antd";
import {
  ApiOutlined,
  FileImageOutlined,
  GlobalOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";

import { changeAdminPassword } from "@/services/api/admin";
import { useUserStore } from "@/stores/use-user-store";

const { Sider, Header, Content } = Layout;

const MENU_ITEMS = [
  { key: "/admin/users", icon: <UserOutlined />, label: "用户管理" },
  { key: "/admin/logs", icon: <FileImageOutlined />, label: "生图日志" },
  { key: "/admin/ads", icon: <GlobalOutlined />, label: "谷歌广告" },
  { key: "/admin/settings?tab=model", icon: <ApiOutlined />, label: "模型配置" },
  { key: "/admin/settings", icon: <SettingOutlined />, label: "系统设置" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useUserStore((state) => state.user);
  const isReady = useUserStore((state) => state.isReady);
  const hydrate = useUserStore((state) => state.hydrate);
  const signOut = useUserStore((state) => state.signOut);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace("/login?redirect=/admin");
    } else if (user.role !== "admin") {
      router.replace("/");
    }
  }, [isReady, user, router]);

  const selectedKey = useMemo(() => {
    const tab = searchParams.get("tab");
    if (pathname === "/admin/settings" && tab === "model") return "/admin/settings?tab=model";
    if (pathname === "/admin" ) return "/admin/users";
    return pathname;
  }, [pathname, searchParams]);

  if (!isReady || !user || user.role !== "admin") {
    return <div className="grid h-dvh place-items-center text-muted-foreground">加载中…</div>;
  }

  return (
    <Layout className="h-dvh">
      <Sider width={232} theme="light" className="border-r border-border">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span
            className="block size-7 bg-foreground"
            style={{ mask: "url(/logo.svg) center / contain no-repeat", WebkitMask: "url(/logo.svg) center / contain no-repeat" }}
            aria-hidden="true"
          />
          <span className="text-base font-semibold">管理后台</span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{ borderInlineEnd: 0, padding: "8px 12px" }}
          items={MENU_ITEMS.map((item) => ({ key: item.key, icon: item.icon, label: item.label }))}
          onClick={({ key }) => router.push(key)}
        />
      </Sider>
      <Layout>
        <Header className="flex items-center justify-between border-b border-border bg-background px-6">
          <span className="text-sm text-muted-foreground">欢迎，{user.displayName || user.username}</span>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={async () => {
              await signOut();
              router.replace("/login");
            }}
          >
            退出登录
          </Button>
        </Header>
        <Content className="overflow-auto bg-background p-6">{children}</Content>
      </Layout>
      <ForcePasswordModal open={Boolean(user.mustChangePassword)} onDone={hydrate} />
    </Layout>
  );
}

function ForcePasswordModal({ open, onDone }: { open: boolean; onDone: () => Promise<void> }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ password: string; confirm: string }>();
  const [submitting, setSubmitting] = useState(false);

  const submit = async (values: { password: string }) => {
    setSubmitting(true);
    try {
      await changeAdminPassword(values.password);
      message.success("密码已更新");
      await onDone();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "更新失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="请修改默认管理员密码" open={open} closable={false} maskClosable={false} footer={null} keyboard={false}>
      <p className="mb-4 text-sm text-muted-foreground">为了安全，首次登录请设置一个新的管理员密码。</p>
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="password" label="新密码" rules={[{ required: true, min: 6, message: "密码至少 6 位" }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="确认新密码"
          dependencies={["password"]}
          rules={[
            { required: true, message: "请再次输入新密码" },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                !value || getFieldValue("password") === value ? Promise.resolve() : Promise.reject(new Error("两次密码不一致")),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          保存
        </Button>
      </Form>
    </Modal>
  );
}
