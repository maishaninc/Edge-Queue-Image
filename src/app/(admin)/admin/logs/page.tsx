"use client";

import { useRef, useState } from "react";
import { ProTable, type ActionType, type ProColumns } from "@ant-design/pro-components";
import { Avatar, Flex, Image, Input, Tag, Typography } from "antd";
import dayjs from "dayjs";

import { fetchAdminLogs, type AdminLog } from "@/services/api/admin";

export default function AdminLogsPage() {
  const actionRef = useRef<ActionType>(null);
  const [keyword, setKeyword] = useState("");

  const columns: ProColumns<AdminLog>[] = [
    {
      title: "用户",
      dataIndex: "username",
      width: 180,
      render: (_, item) => (
        <Flex align="center" gap={8} style={{ minWidth: 0 }}>
          <Avatar size={28} src={item.avatarUrl || undefined}>
            {(item.displayName || item.username || "U").slice(0, 1).toUpperCase()}
          </Avatar>
          <Flex vertical style={{ minWidth: 0 }}>
            <Typography.Text ellipsis>{item.displayName || item.username || "—"}</Typography.Text>
            <Typography.Text type="secondary" ellipsis style={{ fontSize: 11 }}>
              {item.userId?.slice(0, 8) || "—"}
            </Typography.Text>
          </Flex>
        </Flex>
      ),
    },
    {
      title: "提示词",
      dataIndex: "prompt",
      ellipsis: true,
      render: (_, item) => (
        <Typography.Paragraph style={{ margin: 0 }} ellipsis={{ rows: 2, tooltip: item.prompt }}>
          {item.prompt}
        </Typography.Paragraph>
      ),
    },
    {
      title: "图片",
      width: 200,
      render: (_, item) => (
        <Image.PreviewGroup>
          <Flex gap={6}>
            {item.images.slice(0, 4).map((image) => (
              <Image key={image.id} src={image.url} width={44} height={44} style={{ objectFit: "cover", borderRadius: 6 }} />
            ))}
          </Flex>
        </Image.PreviewGroup>
      ),
    },
    { title: "模型", dataIndex: "model", width: 150, ellipsis: true },
    {
      title: "状态",
      dataIndex: "status",
      width: 80,
      render: (_, item) => <Tag color={item.status === "success" ? "green" : "red"}>{item.status === "success" ? "成功" : item.status}</Tag>,
    },
    {
      title: "时间",
      dataIndex: "createdAt",
      width: 170,
      render: (_, item) => dayjs(item.createdAt).format("YYYY-MM-DD HH:mm:ss"),
    },
    { title: "记录 ID", dataIndex: "id", width: 120, copyable: true, ellipsis: true },
  ];

  return (
    <ProTable<AdminLog>
      actionRef={actionRef}
      rowKey="id"
      search={false}
      columns={columns}
      request={async (params) => {
        const { current = 1, pageSize = 20 } = params;
        const { items, total } = await fetchAdminLogs({ page: current, pageSize, keyword });
        return { data: items, total, success: true };
      }}
      toolBarRender={() => [
        <Input.Search
          key="search"
          placeholder="搜索提示词 / 用户名"
          allowClear
          style={{ width: 260 }}
          onSearch={(value) => {
            setKeyword(value);
            actionRef.current?.reload();
          }}
        />,
      ]}
      pagination={{ pageSize: 20 }}
    />
  );
}
