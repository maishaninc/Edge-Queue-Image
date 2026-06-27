import type { PrivateSettings, PublicSettings } from "@/lib/settings-defaults";
import { api } from "@/services/api/request";

export type AdminUser = {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: "user" | "admin";
  status: "active" | "ban";
  authProvider: string;
  googleId: string | null;
  githubId: string | null;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AdminSettings = { public: PublicSettings; private: PrivateSettings };

export type AdminLogImage = { id: string; url: string; width: number; height: number; bytes: number; mime: string };
export type AdminLog = {
  id: string;
  userId: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  prompt: string;
  model: string;
  status: string;
  size: string;
  quality: string;
  imageCount: number;
  durationMs: number;
  createdAt: string;
  images: AdminLogImage[];
};

export async function fetchAdminUsers(params: { page: number; pageSize: number; keyword?: string }) {
  const { data } = await api.get<{ items: AdminUser[]; total: number }>("/api/admin/users", { params });
  return data;
}

export async function saveAdminUser(user: Partial<AdminUser> & { username: string; password?: string }) {
  const { data } = await api.post("/api/admin/users", user);
  return data;
}

export async function deleteAdminUser(id: string) {
  await api.delete(`/api/admin/users/${id}`);
}

export async function fetchAdminSettings(): Promise<AdminSettings> {
  const { data } = await api.get<AdminSettings>("/api/admin/settings");
  return data;
}

export async function saveAdminSettings(update: {
  public?: Partial<PublicSettings>;
  private?: Partial<PrivateSettings>;
}): Promise<AdminSettings> {
  const { data } = await api.post<AdminSettings>("/api/admin/settings", update);
  return data;
}

export async function testChannel(
  channel: PrivateSettings["channels"][number],
  model: string,
  index?: number,
): Promise<{ ok: boolean; error?: string }> {
  const { data } = await api.post<{ ok: boolean; error?: string }>("/api/admin/settings/channel-test", {
    channel,
    model,
    index,
  });
  return data;
}

export async function fetchAdminLogs(params: { page: number; pageSize: number; keyword?: string }) {
  const { data } = await api.get<{ items: AdminLog[]; total: number }>("/api/admin/logs", { params });
  return data;
}

export async function changeAdminPassword(newPassword: string) {
  await api.post("/api/admin/account/password", { newPassword });
}
