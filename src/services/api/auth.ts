import { api } from "@/services/api/request";

export type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: "user" | "admin";
  mustChangePassword: boolean;
  credits: number;
  checkedInToday?: boolean;
};

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const { data } = await api.get<{ user: AuthUser | null }>("/api/auth/me");
  return data?.user ?? null;
}

/** Username + password login (admin / any account that has a password). */
export async function adminLogin(username: string, password: string): Promise<AuthUser> {
  const { data } = await api.post<{ user: AuthUser }>("/api/auth/login", { username, password });
  return data.user;
}

export async function logout(): Promise<void> {
  await api.post("/api/auth/logout");
}

export async function checkIn(): Promise<{ gained: number; credits: number }> {
  const { data } = await api.post<{ gained: number; credits: number }>("/api/checkin");
  return data;
}
