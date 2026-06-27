"use client";

import { useEffect, useState } from "react";
import { App, Button, Card, Col, Form, Input, Row, Switch, Typography } from "antd";

import { fetchAdminSettings, saveAdminSettings } from "@/services/api/admin";

const PAGE_OPTIONS = [
  { key: "home", label: "首页", path: "/" },
  { key: "image", label: "生图工作台", path: "/image" },
  { key: "login", label: "登录页", path: "/login" },
] as const;

export default function AdminAdsPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const settings = await fetchAdminSettings();
        form.setFieldsValue(settings.public.adSense);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [form, message]);

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await saveAdminSettings({ public: { adSense: values } });
      message.success("已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form form={form} layout="vertical" disabled={loading} initialValues={{ enabled: false, pages: {} }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Google AdSense 代码">
            <Form.Item name="enabled" label="启用谷歌广告" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="code" label="脚本代码" extra="粘贴 AdSense 提供的完整 <script> 代码，系统会自动注入到已开启的页面。">
              <Input.TextArea rows={6} placeholder='<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX" crossorigin="anonymous"></script>' />
            </Form.Item>
          </Card>
          <Card title="ads.txt" style={{ marginTop: 16 }}>
            <Form.Item name="adsTxt" label="ads.txt 内容" extra="将通过 /ads.txt 对外提供。">
              <Input.TextArea rows={4} placeholder="google.com, pub-XXXX, DIRECT, f08c47fec0942fa0" />
            </Form.Item>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="页面开关">
            {PAGE_OPTIONS.map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2">
                <div>
                  <Typography.Text strong>{item.label}</Typography.Text>
                  <div className="text-xs text-muted-foreground">{item.path}</div>
                </div>
                <Form.Item name={["pages", item.key]} valuePropName="checked" noStyle>
                  <Switch />
                </Form.Item>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
      <div className="mt-4">
        <Button type="primary" loading={saving} onClick={save}>
          保存
        </Button>
      </div>
    </Form>
  );
}
