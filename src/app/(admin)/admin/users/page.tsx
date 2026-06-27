"use client";

import { useRef, useState } from "react";
import { ProTable, type ActionType, type ProColumns } from "@ant-design/pro-components";
import { App, Avatar, Button, Flex, Form, Input, Modal, Popconfirm, Select, Tag, Typography } from "antd";
import dayjs from "dayjs";

import { deleteAdminUser, fetchAdminUsers, saveAdminUser, type AdminUser } from "@/services/api/admin";

type EditState = { open: boolean; user?: AdminUser };

export default function AdminUsersPage() {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [keyword, setKeyword] = useState("");
  const [edit, setEdit] = useState<EditState>({ open: false });
  const [form] = Form.useForm();

  const openEditor = (user?: AdminUser) => {
    setEdit({ open: true, user });
    form.setFieldsValue({
      username: user?.username || "",
      email: user?.email || "",
      displayName: user?.displayName || "",
      role: user?.role || "user",
      status: user?.status || "active",
      password: "",
    });
  };

  const submit = async () => {
    const values = await form.validateFields();
    try {
      await saveAdminUser({ id: edit.user?.id, ...values });
      message.success("已保存");
      setEdit({ open: false });
      actionRef.current?.reload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteAdminUser(id);
      message.success("已删除");
      actionRef.current?.reload();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const columns: ProColumns<AdminUser>[] = [
    {
      title: "用户",
      dataIndex: "username",
      render: (_, item) => (
        <Flex align="center" gap={10} style={{ minWidth: 0 }}>
          <Avatar src={item.avatarUrl || undefined}>
            {(item.displayName || item.username || "U").slice(0, 1).toUpperCase()}
          </Avatar>
          <Flex vertical style={{ minWidth: 0 }}>
            <Typography.Text strong ellipsis>
              {item.displayName || item.username}
            </Typography.Text>
            <Typography.Text type="secondary" ellipsis style={{ fontSize: 12 }}>
              {item.email || item.username}
            </Typography.Text>
          </Flex>
        </Flex>
      ),
    },
    {
      title: "角色",
      dataIndex: "role",
      width: 90,
      render: (_, item) => <Tag color={item.role === "admin" ? "gold" : "default"}>{item.role === "admin" ? "管理员" : "用户"}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (_, item) => <Tag color={item.status === "ban" ? "red" : "green"}>{item.status === "ban" ? "禁用" : "正常"}</Tag>,
    },
    {
      title: "登录来源",
      dataIndex: "authProvider",
      width: 120,
      render: (_, item) => <Tag>{item.authProvider}</Tag>,
    },
    {
      title: "最近登录",
      dataIndex: "lastLoginAt",
      width: 170,
      render: (_, item) => (item.lastLoginAt ? dayjs(item.lastLoginAt).format("YYYY-MM-DD HH:mm:ss") : "—"),
    },
    {
      title: "操作",
      width: 140,
      render: (_, item) => (
        <Flex gap={8}>
          <a onClick={() => openEditor(item)}>编辑</a>
          <Popconfirm title="确认删除该用户？" onConfirm={() => remove(item.id)}>
            <a className="text-red-500">删除</a>
          </Popconfirm>
        </Flex>
      ),
    },
  ];

  return (
    <>
      <ProTable<AdminUser>
        actionRef={actionRef}
        rowKey="id"
        search={false}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20 } = params;
          const { items, total } = await fetchAdminUsers({ page: current, pageSize, keyword });
          return { data: items, total, success: true };
        }}
        toolBarRender={() => [
          <Input.Search
            key="search"
            placeholder="搜索用户名 / 邮箱"
            allowClear
            style={{ width: 240 }}
            onSearch={(value) => {
              setKeyword(value);
              actionRef.current?.reload();
            }}
          />,
          <Button key="new" type="primary" onClick={() => openEditor()}>
            新建用户
          </Button>,
        ]}
        pagination={{ pageSize: 20 }}
      />

      <Modal title={edit.user ? "编辑用户" : "新建用户"} open={edit.open} onOk={submit} onCancel={() => setEdit({ open: false })} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
          <Flex gap={12}>
            <Form.Item name="role" label="角色" className="flex-1">
              <Select
                options={[
                  { value: "user", label: "用户" },
                  { value: "admin", label: "管理员" },
                ]}
              />
            </Form.Item>
            <Form.Item name="status" label="状态" className="flex-1">
              <Select
                options={[
                  { value: "active", label: "正常" },
                  { value: "ban", label: "禁用" },
                ]}
              />
            </Form.Item>
          </Flex>
          <Form.Item name="password" label={edit.user ? "重置密码（留空不修改）" : "密码（可选）"}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
