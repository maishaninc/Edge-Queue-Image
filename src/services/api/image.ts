import { api } from "@/services/api/request";

export type GenImage = {
  id: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  mime: string;
};

export type JobStatus = "succeeded" | "failed" | "queued" | "executing" | "canceled";

export type SubmitResponse = {
  status: JobStatus;
  taskId?: string;
  historyId?: string;
  images?: GenImage[];
  error?: string;
  queuePosition?: number;
  aheadCount?: number;
  durationMs?: number;
};

export type GenerationConfig = {
  model: string;
  prompt: string;
  size?: string;
  quality?: string;
  count: number;
  references?: string[];
  captchaToken?: string;
};

export type HistoryItem = {
  id: string;
  title: string;
  prompt: string;
  model: string;
  status: string;
  durationMs: number;
  successCount: number;
  failCount: number;
  imageCount: number;
  size: string;
  quality: string;
  createdAt: string;
  images: GenImage[];
};

export async function requestGeneration(payload: GenerationConfig): Promise<SubmitResponse> {
  const { data } = await api.post<SubmitResponse>("/api/jobs", payload);
  return data;
}

export async function pollJob(taskId: string): Promise<SubmitResponse> {
  const { data } = await api.get<SubmitResponse>(`/api/jobs/${taskId}`);
  return data;
}

export async function cancelJob(taskId: string): Promise<void> {
  await api.delete(`/api/jobs/${taskId}`);
}

export async function fetchHistories(page = 1, pageSize = 20): Promise<{ items: HistoryItem[]; total: number }> {
  const { data } = await api.get<{ items: HistoryItem[]; total: number }>(
    `/api/generation-histories?page=${page}&pageSize=${pageSize}`,
  );
  return data;
}

export async function deleteHistory(id: string): Promise<void> {
  await api.delete(`/api/generation-histories/${id}`);
}

/** Fetch a stored image URL and convert it to a data URL (for reference re-use). */
export async function imageUrlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { credentials: "include" });
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
