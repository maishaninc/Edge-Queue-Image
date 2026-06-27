import "server-only";

import type { ModelChannel } from "@/lib/settings-defaults";

export type GeneratedImage = {
  b64: string;
  mime: string;
  width: number;
  height: number;
};

/** Weighted pick of an enabled channel that can serve `model`. */
export function selectChannel(channels: ModelChannel[], model: string): ModelChannel | undefined {
  const matches = channels.filter(
    (c) => c.enabled && c.baseUrl && c.apiKey && (c.models.length === 0 || c.models.includes(model)),
  );
  if (!matches.length) return undefined;
  const total = matches.reduce((sum, c) => sum + Math.max(1, c.weight || 1), 0);
  let r = Math.random() * total;
  for (const c of matches) {
    r -= Math.max(1, c.weight || 1);
    if (r <= 0) return c;
  }
  return matches[0];
}

function parseSize(size: string | undefined): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec((size || "").trim());
  if (!match) return { width: 0, height: 0 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/png";
  const buffer = Buffer.from(b64 || "", "base64");
  return new Blob([buffer], { type: mime });
}

function parseProviderError(text: string, status: number): string {
  try {
    const parsed = JSON.parse(text);
    const msg = parsed?.error?.message || parsed?.message || parsed?.error;
    if (msg) return String(msg);
  } catch {
    // fall through
  }
  return `生成失败（${status}）${text ? `：${text.slice(0, 200)}` : ""}`;
}

async function fetchUrlAsImage(url: string, size: string | undefined): Promise<GeneratedImage> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`下载生成图片失败（${response.status}）`);
  const mime = response.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());
  return { b64: buffer.toString("base64"), mime, ...parseSize(size) };
}

/**
 * Call an OpenAI-compatible images API. Uses `images/edits` (multipart) when
 * reference images are supplied, otherwise `images/generations` (JSON).
 * Handles both `b64_json` and `url` response shapes.
 */
export async function generateImages(
  channel: ModelChannel,
  opts: {
    model: string;
    prompt: string;
    size?: string;
    quality?: string;
    n: number;
    references?: string[];
  },
): Promise<GeneratedImage[]> {
  const base = channel.baseUrl.replace(/\/+$/, "");
  const useEdit = Boolean(opts.references && opts.references.length);
  const endpoint = useEdit ? `${base}/images/edits` : `${base}/images/generations`;

  let response: Response;
  if (useEdit) {
    const fd = new FormData();
    fd.set("model", opts.model);
    fd.set("prompt", opts.prompt);
    fd.set("n", String(opts.n));
    if (opts.size && opts.size !== "auto") fd.set("size", opts.size);
    if (opts.quality && opts.quality !== "auto") fd.set("quality", opts.quality);
    (opts.references || []).forEach((ref, index) => {
      fd.append("image[]", dataUrlToBlob(ref), `reference-${index}.png`);
    });
    response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${channel.apiKey}` },
      body: fd,
    });
  } else {
    const body: Record<string, unknown> = { model: opts.model, prompt: opts.prompt, n: opts.n };
    if (opts.size && opts.size !== "auto") body.size = opts.size;
    if (opts.quality && opts.quality !== "auto") body.quality = opts.quality;
    response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${channel.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  if (!response.ok) {
    throw new Error(parseProviderError(await response.text(), response.status));
  }

  const data = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const items = Array.isArray(data?.data) ? data.data : [];
  const results: GeneratedImage[] = [];
  for (const item of items) {
    if (item.b64_json) {
      results.push({ b64: item.b64_json, mime: "image/png", ...parseSize(opts.size) });
    } else if (item.url) {
      results.push(await fetchUrlAsImage(item.url, opts.size));
    }
  }
  if (!results.length) throw new Error("生成失败：模型未返回图片");
  return results;
}

/** Lightweight reachability/credential test for a channel + model. */
export async function testChannelModel(channel: ModelChannel, model: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await generateImages(channel, { model, prompt: "a small red circle on white background", n: 1, size: "1024x1024" });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "测试失败" };
  }
}
