"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  App,
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";

import { fetchAdminSettings, saveAdminSettings, testChannel, type AdminSettings } from "@/services/api/admin";
import type { ModelChannel } from "@/lib/settings-defaults";

const TAB_KEYS = ["model", "thirdParty", "access", "captcha", "runtime"] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default function AdminSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const tabParam = searchParams.get("tab");
  const tab: TabKey = (TAB_KEYS as readonly string[]).includes(tabParam || "") ? (tabParam as TabKey) : "access";

  const reload = async () => {
    const data = await fetchAdminSettings();
    setSettings(data);
  };

  useEffect(() => {
    void (async () => {
      try {
        await reload();
      } catch (error) {
        message.error(error instanceof Error ? error.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [message]);

  if (loading || !settings) {
    return (
      <div className="grid h-64 place-items-center">
        <Spin />
      </div>
    );
  }

  const onTabChange = (key: string) => router.replace(key === "access" ? "/admin/settings" : `/admin/settings?tab=${key}`);

  const items = [
    { key: "model", label: "模型配置", children: <ModelTab settings={settings} onSaved={reload} /> },
    { key: "thirdParty", label: "第三方登录", children: <OAuthTab settings={settings} onSaved={reload} /> },
    { key: "access", label: "注册与访问", children: <AccessTab settings={settings} onSaved={reload} /> },
    { key: "captcha", label: "验证码", children: <CaptchaTab settings={settings} onSaved={reload} /> },
    { key: "runtime", label: "运行配置", children: <RuntimeTab settings={settings} onSaved={reload} /> },
  ];

  // Render the active tab only (keeps forms simple and avoids stale state).
  const active = items.find((item) => item.key === tab) ?? items[2];

  return (
    <div>
      <Flex gap={8} className="mb-5 flex-wrap">
        {items.map((item) => (
          <Button key={item.key} type={item.key === tab ? "primary" : "default"} onClick={() => onTabChange(item.key)}>
            {item.label}
          </Button>
        ))}
      </Flex>
      {active.children}
    </div>
  );
}

type TabProps = { settings: AdminSettings; onSaved: () => Promise<void> };

function useSaver(onSaved: () => Promise<void>) {
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const save = async (update: Parameters<typeof saveAdminSettings>[0]) => {
    setSaving(true);
    try {
      await saveAdminSettings(update);
      await onSaved();
      message.success("已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };
  return { saving, save };
}

// ----------------------------- Model config -----------------------------

function ModelTab({ settings, onSaved }: TabProps) {
  const { message } = App.useApp();
  const { saving, save } = useSaver(onSaved);
  const [form] = Form.useForm();
  const [channels, setChannels] = useState<ModelChannel[]>(settings.private.channels);
  const [editor, setEditor] = useState<{ open: boolean; index: number | null }>({ open: false, index: null });
  const [channelForm] = Form.useForm<ModelChannel>();

  const allModels = useMemo(
    () => Array.from(new Set(channels.flatMap((c) => c.models).filter(Boolean))),
    [channels],
  );

  useEffect(() => {
    form.setFieldsValue({
      availableModels: settings.public.models.availableModels,
      defaultImageModel: settings.public.models.defaultImageModel,
      qualities: settings.public.models.qualities,
      sizes: settings.public.models.sizes,
    });
  }, [form, settings]);

  const openChannel = (index: number | null) => {
    setEditor({ open: true, index });
    channelForm.setFieldsValue(
      index === null
        ? { protocol: "openai", name: "", baseUrl: "", apiKey: "", models: [], weight: 1, enabled: true, remark: "" }
        : { ...channels[index], apiKey: "" },
    );
  };

  const saveChannel = async () => {
    const values = await channelForm.validateFields();
    const next = [...channels];
    if (editor.index === null) next.push(values);
    else next[editor.index] = { ...next[editor.index], ...values, apiKey: values.apiKey || next[editor.index].apiKey };
    setChannels(next);
    setEditor({ open: false, index: null });
  };

  const test = async (index: number) => {
    const channel = channels[index];
    const model = channel.models[0];
    if (!model) {
      message.warning("该渠道未配置模型");
      return;
    }
    message.loading({ content: "测试中…", key: "test" });
    try {
      const result = await testChannel(channel, model, index);
      if (result.ok) message.success({ content: "测试通过", key: "test" });
      else message.error({ content: result.error || "测试失败", key: "test" });
    } catch (error) {
      message.error({ content: error instanceof Error ? error.message : "测试失败", key: "test" });
    }
  };

  const onSave = async () => {
    const values = await form.validateFields();
    await save({
      public: { models: values },
      private: { channels },
    });
  };

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={10}>
        <Card title="对外可用模型">
          <Form form={form} layout="vertical">
            <Form.Item name="availableModels" label="可选模型（用户在工作台可见）">
              <Select mode="tags" placeholder="例如 gpt-image-1" options={allModels.map((m) => ({ value: m }))} />
            </Form.Item>
            <Form.Item name="defaultImageModel" label="默认图片模型">
              <Select showSearch placeholder="选择默认模型" options={allModels.map((m) => ({ value: m }))} />
            </Form.Item>
            <Form.Item name="qualities" label="质量选项">
              <Select mode="tags" />
            </Form.Item>
            <Form.Item name="sizes" label="尺寸选项">
              <Select mode="tags" placeholder="例如 1024x1024" />
            </Form.Item>
          </Form>
        </Card>
      </Col>
      <Col xs={24} lg={14}>
        <Card
          title="模型渠道"
          extra={
            <Button type="primary" onClick={() => openChannel(null)}>
              新增渠道
            </Button>
          }
        >
          <Table<ModelChannel>
            rowKey={(_, index) => String(index)}
            dataSource={channels}
            pagination={false}
            columns={[
              { title: "名称", dataIndex: "name" },
              { title: "Base URL", dataIndex: "baseUrl", ellipsis: true },
              {
                title: "模型",
                dataIndex: "models",
                render: (models: string[]) => (
                  <Flex gap={4} wrap>
                    {models.slice(0, 3).map((m) => (
                      <Tag key={m}>{m}</Tag>
                    ))}
                    {models.length > 3 ? <Tag>+{models.length - 3}</Tag> : null}
                  </Flex>
                ),
              },
              {
                title: "状态",
                dataIndex: "enabled",
                width: 70,
                render: (enabled: boolean) => <Tag color={enabled ? "green" : "default"}>{enabled ? "启用" : "停用"}</Tag>,
              },
              {
                title: "操作",
                width: 150,
                render: (_, __, index) => (
                  <Flex gap={8}>
                    <a onClick={() => test(index)}>测试</a>
                    <a onClick={() => openChannel(index)}>编辑</a>
                    <a className="text-red-500" onClick={() => setChannels(channels.filter((_, i) => i !== index))}>
                      删除
                    </a>
                  </Flex>
                ),
              },
            ]}
          />
        </Card>
        <div className="mt-4">
          <Button type="primary" loading={saving} onClick={onSave}>
            保存模型配置
          </Button>
          <Typography.Text type="secondary" className="ml-3">
            提示：渠道 API Key 留空表示沿用已保存的值。
          </Typography.Text>
        </div>
      </Col>

      <Modal
        title={editor.index === null ? "新增渠道" : "编辑渠道"}
        open={editor.open}
        onOk={saveChannel}
        onCancel={() => setEditor({ open: false, index: null })}
        destroyOnHidden
      >
        <Form form={channelForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input placeholder="例如 OpenAI 官方" />
          </Form.Item>
          <Form.Item name="baseUrl" label="Base URL" rules={[{ required: true, message: "请输入 Base URL" }]}>
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key（留空沿用已保存）">
            <Input.Password placeholder="sk-..." autoComplete="off" />
          </Form.Item>
          <Form.Item name="models" label="模型列表" rules={[{ required: true, message: "请至少添加一个模型" }]}>
            <Select mode="tags" placeholder="例如 gpt-image-1" />
          </Form.Item>
          <Flex gap={12}>
            <Form.Item name="weight" label="权重" className="flex-1">
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Flex>
          <Form.Item name="protocol" hidden initialValue="openai">
            <Input />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Row>
  );
}

// ----------------------------- OAuth -----------------------------

function OAuthTab({ settings, onSaved }: TabProps) {
  const { saving, save } = useSaver(onSaved);
  const [form] = Form.useForm();
  const origin = settings.private.runtime.appOrigin || (typeof window !== "undefined" ? window.location.origin : "");

  useEffect(() => {
    form.setFieldsValue({
      google: { ...settings.private.auth.google, clientSecret: "", name: settings.public.auth.google.name, iconUrl: settings.public.auth.google.iconUrl },
      github: { ...settings.private.auth.github, clientSecret: "", name: settings.public.auth.github.name, iconUrl: settings.public.auth.github.iconUrl },
    });
  }, [form, settings]);

  const onSave = async () => {
    const values = await form.validateFields();
    const build = (key: "google" | "github") => values[key];
    await save({
      public: {
        auth: {
          google: { enabled: build("google").enabled, name: build("google").name, iconUrl: build("google").iconUrl },
          github: { enabled: build("github").enabled, name: build("github").name, iconUrl: build("github").iconUrl },
        },
      },
      private: {
        auth: {
          google: {
            enabled: build("google").enabled,
            clientId: build("google").clientId,
            clientSecret: build("google").clientSecret,
            authorizeUrl: build("google").authorizeUrl,
            tokenUrl: build("google").tokenUrl,
            userInfoUrl: build("google").userInfoUrl,
            scope: build("google").scope,
          },
          github: {
            enabled: build("github").enabled,
            clientId: build("github").clientId,
            clientSecret: build("github").clientSecret,
            authorizeUrl: build("github").authorizeUrl,
            tokenUrl: build("github").tokenUrl,
            userInfoUrl: build("github").userInfoUrl,
            scope: build("github").scope,
          },
        },
      },
    });
  };

  return (
    <Form form={form} layout="vertical">
      <Row gutter={[16, 16]}>
        {(["google", "github"] as const).map((provider) => (
          <Col xs={24} lg={12} key={provider}>
            <Card title={provider === "google" ? "Google 登录" : "GitHub 登录"}>
              <Form.Item name={[provider, "enabled"]} label="启用" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name={[provider, "name"]} label="按钮名称">
                <Input />
              </Form.Item>
              <Form.Item name={[provider, "iconUrl"]} label="按钮图标 URL">
                <Input placeholder="可留空" />
              </Form.Item>
              <Form.Item name={[provider, "clientId"]} label="Client ID">
                <Input autoComplete="off" />
              </Form.Item>
              <Form.Item name={[provider, "clientSecret"]} label="Client Secret（留空沿用已保存）">
                <Input.Password autoComplete="off" />
              </Form.Item>
              <Form.Item name={[provider, "authorizeUrl"]} label="Authorize URL">
                <Input />
              </Form.Item>
              <Form.Item name={[provider, "tokenUrl"]} label="Token URL">
                <Input />
              </Form.Item>
              <Form.Item name={[provider, "userInfoUrl"]} label="UserInfo URL">
                <Input />
              </Form.Item>
              <Form.Item name={[provider, "scope"]} label="Scope">
                <Input />
              </Form.Item>
              <Typography.Paragraph type="secondary" copyable={{ text: `${origin}/api/auth/oauth/${provider}/callback` }}>
                回调地址：{origin || "<站点域名>"}/api/auth/oauth/{provider}/callback
              </Typography.Paragraph>
            </Card>
          </Col>
        ))}
      </Row>
      <div className="mt-4">
        <Button type="primary" loading={saving} onClick={onSave}>
          保存第三方登录
        </Button>
      </div>
    </Form>
  );
}

// ----------------------------- Access -----------------------------

function AccessTab({ settings, onSaved }: TabProps) {
  const { saving, save } = useSaver(onSaved);
  const [form] = Form.useForm();
  useEffect(() => {
    form.setFieldsValue({
      siteName: settings.public.site.name,
      allowRegister: settings.public.access.allowRegister,
      imageLoginRequired: settings.public.access.imageLoginRequired,
    });
  }, [form, settings]);

  const onSave = async () => {
    const values = await form.validateFields();
    await save({
      public: {
        site: { name: values.siteName },
        access: { allowRegister: values.allowRegister, imageLoginRequired: values.imageLoginRequired },
      },
    });
  };

  return (
    <Card title="注册与访问" style={{ maxWidth: 560 }}>
      <Form form={form} layout="vertical">
        <Form.Item name="siteName" label="站点名称">
          <Input />
        </Form.Item>
        <Form.Item name="imageLoginRequired" label="生图需要登录" valuePropName="checked" extra="关闭后未登录用户也能进入工作台（但仍需登录才能生成）。">
          <Switch />
        </Form.Item>
        <Form.Item name="allowRegister" label="开放账号密码注册" valuePropName="checked" extra="默认关闭，普通用户通过 Google / GitHub 登录。">
          <Switch />
        </Form.Item>
        <Button type="primary" loading={saving} onClick={onSave}>
          保存
        </Button>
      </Form>
    </Card>
  );
}

// ----------------------------- Captcha -----------------------------

function CaptchaTab({ settings, onSaved }: TabProps) {
  const { saving, save } = useSaver(onSaved);
  const [form] = Form.useForm();
  useEffect(() => {
    form.setFieldsValue({
      provider: settings.public.captcha.provider,
      siteKey: settings.public.captcha.siteKey,
      secretKey: "",
    });
  }, [form, settings]);

  const onSave = async () => {
    const values = await form.validateFields();
    await save({
      public: { captcha: { provider: values.provider, siteKey: values.siteKey } },
      private: { captcha: { provider: values.provider, siteKey: values.siteKey, secretKey: values.secretKey } },
    });
  };

  return (
    <Card title="验证码" style={{ maxWidth: 560 }}>
      <Form form={form} layout="vertical">
        <Form.Item name="provider" label="验证码服务">
          <Select
            options={[
              { value: "none", label: "不启用" },
              { value: "turnstile", label: "Cloudflare Turnstile" },
              { value: "hcaptcha", label: "hCaptcha" },
            ]}
          />
        </Form.Item>
        <Form.Item name="siteKey" label="Site Key">
          <Input />
        </Form.Item>
        <Form.Item name="secretKey" label="Secret Key（留空沿用已保存）">
          <Input.Password autoComplete="off" />
        </Form.Item>
        <Button type="primary" loading={saving} onClick={onSave}>
          保存
        </Button>
      </Form>
    </Card>
  );
}

// ----------------------------- Runtime -----------------------------

function RuntimeTab({ settings, onSaved }: TabProps) {
  const { saving, save } = useSaver(onSaved);
  const [form] = Form.useForm();
  useEffect(() => {
    form.setFieldsValue({
      appOrigin: settings.private.runtime.appOrigin,
      sessionExpireHours: settings.private.runtime.sessionExpireHours,
      imageRetentionDays: settings.private.imageRetentionDays,
      activeLimit: settings.private.queue.activeLimit,
      maxQueue: settings.private.queue.maxQueue,
      dailyLimit: settings.private.queue.dailyLimit,
    });
  }, [form, settings]);

  const onSave = async () => {
    const values = await form.validateFields();
    await save({
      private: {
        runtime: { appOrigin: values.appOrigin, sessionExpireHours: values.sessionExpireHours },
        imageRetentionDays: values.imageRetentionDays,
        queue: { activeLimit: values.activeLimit, maxQueue: values.maxQueue, dailyLimit: values.dailyLimit },
      },
    });
  };

  return (
    <Card title="运行配置" style={{ maxWidth: 560 }}>
      <Form form={form} layout="vertical">
        <Form.Item name="appOrigin" label="站点域名（用于 OAuth 回调）" extra="留空则自动根据请求推导，例如 https://your-app.vercel.app">
          <Input placeholder="https://your-app.vercel.app" />
        </Form.Item>
        <Form.Item name="sessionExpireHours" label="登录有效期（小时）">
          <InputNumber min={1} max={8760} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="imageRetentionDays" label="图片保留天数（到期自动清理）">
          <InputNumber min={1} max={365} style={{ width: "100%" }} />
        </Form.Item>
        <Flex gap={12}>
          <Form.Item name="activeLimit" label="并发生成数" className="flex-1">
            <InputNumber min={1} max={20} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="maxQueue" label="最大排队数" className="flex-1">
            <InputNumber min={0} max={500} style={{ width: "100%" }} />
          </Form.Item>
        </Flex>
        <Form.Item name="dailyLimit" label="单用户每日生成上限（0 = 不限制）">
          <InputNumber min={0} max={10000} style={{ width: "100%" }} />
        </Form.Item>
        <Button type="primary" loading={saving} onClick={onSave}>
          保存
        </Button>
      </Form>
    </Card>
  );
}
