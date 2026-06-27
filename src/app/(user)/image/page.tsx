"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Drawer, Empty, Image, Input, Tag } from "antd";
import { Download, ImagePlus, Plus, Settings2, Trash2, X } from "lucide-react";
import { saveAs } from "file-saver";
import { nanoid } from "nanoid";

import { AivroDrawableLoader } from "@/components/aivro-drawable-loader";
import { AivroReveal } from "@/components/aivro-reveal";
import { AppHeader } from "@/components/app-header";
import { CaptchaWidget } from "@/components/captcha-widget";
import { ImageSettingsPanel } from "@/components/image-settings-panel";
import { ModelPicker } from "@/components/model-picker";
import { useI18n } from "@/hooks/use-i18n";
import {
  cancelJob,
  deleteHistory,
  fetchHistories,
  imageUrlToDataUrl,
  pollJob,
  requestGeneration,
  type GenImage,
  type HistoryItem,
} from "@/services/api/image";
import { useConfigStore } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

type ResultState = {
  id: string;
  status: "pending" | "queued" | "executing" | "success" | "failed";
  image?: GenImage;
  error?: string;
  queuePosition?: number;
  aheadCount?: number;
  taskId?: string;
};

type ReferenceImage = { id: string; name: string; dataUrl: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ImagePage() {
  const { message } = App.useApp();
  const { locale } = useI18n();
  const user = useUserStore((state) => state.user);
  const config = useConfigStore((state) => state.config);
  const updateConfig = useConfigStore((state) => state.updateConfig);
  const publicSettings = useConfigStore((state) => state.publicSettings);

  const models = useMemo(() => publicSettings?.models?.availableModels ?? [], [publicSettings]);
  const qualities = publicSettings?.models?.qualities ?? ["auto", "high", "medium", "low"];
  const captcha = publicSettings?.captcha;
  const captchaEnabled = Boolean(captcha && captcha.provider !== "none" && captcha.siteKey);

  const [prompt, setPrompt] = useState("");
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [results, setResults] = useState<ResultState[]>([]);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [logs, setLogs] = useState<HistoryItem[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const startedAtRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generationCount = Math.max(1, Math.min(4, Number(config.count) || 1));

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setElapsedMs(performance.now() - startedAtRef.current), 200);
    return () => window.clearInterval(timer);
  }, [running]);

  const refreshLogs = useMemo(
    () => async () => {
      if (!user) {
        setLogs([]);
        return;
      }
      try {
        const { items } = await fetchHistories(1, 30);
        setLogs(items);
      } catch {
        // ignore
      }
    },
    [user],
  );

  useEffect(() => {
    void refreshLogs();
  }, [refreshLogs]);

  const onPickReferences = async (files: FileList | null) => {
    if (!files?.length) return;
    const next: ReferenceImage[] = [];
    for (const file of Array.from(files).slice(0, 4 - references.length)) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      next.push({ id: nanoid(), name: file.name, dataUrl });
    }
    setReferences((prev) => [...prev, ...next].slice(0, 4));
  };

  const generate = async () => {
    const text = prompt.trim();
    if (!text) {
      message.error(locale === "en-US" ? "Enter a prompt" : "请输入生图提示词");
      return;
    }
    if (!config.imageModel) {
      message.error(locale === "en-US" ? "No model configured" : "管理员尚未配置可用模型");
      return;
    }
    if (captchaEnabled && !captchaToken) {
      message.error(locale === "en-US" ? "Please complete the captcha" : "请先完成人机验证");
      return;
    }

    setRunning(true);
    startedAtRef.current = performance.now();
    setElapsedMs(0);
    setResults(Array.from({ length: generationCount }, () => ({ id: nanoid(), status: "pending" as const })));

    try {
      const response = await requestGeneration({
        model: config.imageModel,
        prompt: text,
        size: config.size,
        quality: config.quality,
        count: generationCount,
        references: references.length ? references.map((item) => item.dataUrl) : undefined,
        captchaToken: captchaEnabled ? captchaToken : undefined,
      });

      let final = response;
      if (response.status === "queued" && response.taskId) {
        setResults((prev) =>
          prev.map((item) => ({ ...item, status: "queued", queuePosition: response.queuePosition, aheadCount: response.aheadCount, taskId: response.taskId })),
        );
        final = await pollUntilDone(response.taskId);
      }

      if (final.status === "succeeded" && final.images?.length) {
        setResults(final.images.map((image) => ({ id: image.id, status: "success" as const, image })));
        void refreshLogs();
      } else if (final.status === "failed") {
        const error = final.error || (locale === "en-US" ? "Generation failed" : "生成失败");
        setResults((prev) => prev.map((item) => ({ ...item, status: "failed", error })));
        message.error(error);
      } else if (final.status === "canceled") {
        setResults([]);
      }
    } catch (error) {
      const text2 = error instanceof Error ? error.message : locale === "en-US" ? "Generation failed" : "生成失败";
      setResults((prev) => prev.map((item) => ({ ...item, status: "failed", error: text2 })));
      message.error(text2);
    } finally {
      setRunning(false);
      if (captchaEnabled) {
        setCaptchaToken("");
        setCaptchaKey((key) => key + 1);
      }
    }
  };

  const pollUntilDone = async (taskId: string) => {
    for (let attempt = 0; attempt < 150; attempt += 1) {
      await sleep(2000);
      const res = await pollJob(taskId);
      if (res.status === "succeeded" || res.status === "failed" || res.status === "canceled") return res;
      setResults((prev) =>
        prev.map((item) => ({
          ...item,
          status: res.status === "executing" ? "executing" : "queued",
          queuePosition: res.queuePosition,
          aheadCount: res.aheadCount,
        })),
      );
    }
    throw new Error(locale === "en-US" ? "Generation timed out" : "生成超时");
  };

  const cancelQueued = async (taskId?: string) => {
    if (taskId) {
      try {
        await cancelJob(taskId);
      } catch {
        // ignore
      }
    }
    setResults([]);
    setRunning(false);
  };

  const download = async (image: GenImage, index: number) => {
    try {
      const response = await fetch(image.url, { credentials: "include" });
      const blob = await response.blob();
      saveAs(blob, `image-${index + 1}.png`);
    } catch {
      message.error(locale === "en-US" ? "Download failed" : "下载失败");
    }
  };

  const addToReferences = async (image: GenImage) => {
    if (references.length >= 4) {
      message.warning(locale === "en-US" ? "Up to 4 references" : "最多 4 张参考图");
      return;
    }
    try {
      const dataUrl = await imageUrlToDataUrl(image.url);
      setReferences((prev) => [...prev, { id: nanoid(), name: "reference", dataUrl }].slice(0, 4));
      message.success(locale === "en-US" ? "Added to references" : "已加入参考图");
    } catch {
      message.error(locale === "en-US" ? "Failed" : "操作失败");
    }
  };

  const openLog = (log: HistoryItem) => {
    setResults(log.images.map((image) => ({ id: image.id, status: "success" as const, image })));
    setLogsOpen(false);
  };

  const removeLog = async (id: string) => {
    try {
      await deleteHistory(id);
      setLogs((prev) => prev.filter((item) => item.id !== id));
    } catch {
      message.error(locale === "en-US" ? "Delete failed" : "删除失败");
    }
  };

  const settingsPanel = (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-medium text-muted-foreground">{locale === "en-US" ? "Model" : "模型"}</div>
        <ModelPicker models={models} value={config.imageModel} onChange={(model) => updateConfig({ imageModel: model })} />
      </div>
      <ImageSettingsPanel
        quality={config.quality}
        size={config.size}
        count={config.count}
        qualities={qualities}
        onChange={(key, value) => updateConfig({ [key]: value })}
      />
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <AppHeader />
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="thin-scrollbar hidden min-h-0 overflow-y-auto rounded-2xl border border-border bg-card/40 p-3 lg:block">
          <LogPanel logs={logs} onOpen={openLog} onDelete={removeLog} emptyText={locale === "en-US" ? "No history yet" : "暂无生成记录"} />
        </aside>

        <section className="grid min-h-0 gap-3 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="thin-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card/40 p-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">{locale === "en-US" ? "Image Studio" : "生图工作台"}</h1>
              <div className="flex gap-1 lg:hidden">
                <Button size="small" type="text" icon={<Settings2 className="size-4" />} onClick={() => setSettingsOpen(true)} />
                <Button size="small" type="text" icon={<ImagePlus className="size-4" />} onClick={() => setLogsOpen(true)} />
              </div>
            </div>

            <Input.TextArea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={locale === "en-US" ? "Describe the image you want…" : "描述你想生成的画面…"}
              autoSize={{ minRows: 4, maxRows: 10 }}
              maxLength={4000}
            />

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">{locale === "en-US" ? "Reference images" : "参考图"}</div>
              <div className="flex flex-wrap gap-2">
                {references.map((ref) => (
                  <div key={ref.id} className="relative size-16 overflow-hidden rounded-lg border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ref.dataUrl} alt={ref.name} className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setReferences((prev) => prev.filter((item) => item.id !== ref.id))}
                      className="absolute right-0 top-0 grid size-5 place-items-center rounded-bl-lg bg-black/60 text-white"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {references.length < 4 ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="grid size-16 place-items-center rounded-lg border border-dashed border-border text-muted-foreground hover:border-foreground"
                  >
                    <Plus className="size-5" />
                  </button>
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(event) => {
                    void onPickReferences(event.target.files);
                    event.target.value = "";
                  }}
                />
              </div>
            </div>

            <div className="hidden lg:block">{settingsPanel}</div>

            <div className="mt-auto pt-2">
              {captchaEnabled && captcha ? (
                <CaptchaWidget
                  provider={captcha.provider}
                  siteKey={captcha.siteKey}
                  onToken={setCaptchaToken}
                  refreshKey={captchaKey}
                />
              ) : null}
              <Button
                type="primary"
                block
                size="large"
                loading={running}
                disabled={!models.length}
                onClick={() => void generate()}
              >
                {running
                  ? `${locale === "en-US" ? "Generating" : "生成中"}${elapsedMs ? ` ${(elapsedMs / 1000).toFixed(1)}s` : ""}`
                  : locale === "en-US"
                    ? "Generate"
                    : "开始生成"}
              </Button>
            </div>
          </div>

          <div className="thin-scrollbar min-h-0 overflow-y-auto rounded-2xl border border-border bg-card/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">{locale === "en-US" ? "Results" : "生成结果"}</h2>
            {results.length ? (
              <Image.PreviewGroup>
                <div className={`grid gap-4 ${results.length > 1 ? "sm:grid-cols-2" : ""}`}>
                  {results.map((result, index) => (
                    <ResultCard
                      key={result.id}
                      result={result}
                      index={index}
                      locale={locale}
                      onDownload={download}
                      onAddReference={addToReferences}
                      onCancel={cancelQueued}
                    />
                  ))}
                </div>
              </Image.PreviewGroup>
            ) : (
              <div className="grid h-full place-items-center">
                <Empty description={locale === "en-US" ? "Your generated images appear here" : "生成的图片会显示在这里"} />
              </div>
            )}
          </div>
        </section>
      </main>

      <Drawer title={locale === "en-US" ? "History" : "生成记录"} placement="left" open={logsOpen} onClose={() => setLogsOpen(false)}>
        <LogPanel logs={logs} onOpen={openLog} onDelete={removeLog} emptyText={locale === "en-US" ? "No history yet" : "暂无生成记录"} />
      </Drawer>
      <Drawer title={locale === "en-US" ? "Settings" : "参数"} placement="right" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        {settingsPanel}
      </Drawer>
    </div>
  );
}

function ResultCard({
  result,
  index,
  locale,
  onDownload,
  onAddReference,
  onCancel,
}: {
  result: ResultState;
  index: number;
  locale: string;
  onDownload: (image: GenImage, index: number) => void;
  onAddReference: (image: GenImage) => void;
  onCancel: (taskId?: string) => void;
}) {
  if (result.status === "success" && result.image) {
    return (
      <AivroReveal>
        <div data-aivro-reveal className="overflow-hidden rounded-xl border border-border bg-background">
          <Image src={result.image.url} alt="" className="aspect-square w-full object-cover" />
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
            <span>
              {result.image.width && result.image.height ? `${result.image.width}×${result.image.height}` : ""}
            </span>
            <div className="flex gap-1">
              <Button size="small" type="text" icon={<ImagePlus className="size-4" />} onClick={() => onAddReference(result.image!)} title={locale === "en-US" ? "Add to references" : "加入参考图"} />
              <Button size="small" type="text" icon={<Download className="size-4" />} onClick={() => onDownload(result.image!, index)} title={locale === "en-US" ? "Download" : "下载"} />
            </div>
          </div>
        </div>
      </AivroReveal>
    );
  }

  if (result.status === "failed") {
    return (
      <div className="grid aspect-square place-items-center rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-center text-sm text-destructive">
        <span className="line-clamp-4">{result.error || (locale === "en-US" ? "Failed" : "生成失败")}</span>
      </div>
    );
  }

  if (result.status === "queued") {
    return (
      <div className="grid aspect-square place-items-center rounded-xl border border-border bg-background p-4 text-center">
        <div className="flex flex-col items-center gap-3">
          <AivroDrawableLoader compact />
          <Tag>
            {locale === "en-US" ? `Queued · ${result.queuePosition ?? ""}` : `排队中 · 第 ${result.queuePosition ?? ""} 位`}
          </Tag>
          <Button size="small" onClick={() => onCancel(result.taskId)}>
            {locale === "en-US" ? "Cancel" : "取消"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid aspect-square place-items-center rounded-xl border border-border bg-background p-4">
      <AivroDrawableLoader compact />
    </div>
  );
}

function LogPanel({
  logs,
  onOpen,
  onDelete,
  emptyText,
}: {
  logs: HistoryItem[];
  onOpen: (log: HistoryItem) => void;
  onDelete: (id: string) => void;
  emptyText: string;
}) {
  if (!logs.length) {
    return <div className="grid h-40 place-items-center text-sm text-muted-foreground">{emptyText}</div>;
  }
  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="group rounded-xl border border-border bg-background p-2 transition hover:border-foreground/40">
          <button type="button" onClick={() => onOpen(log)} className="block w-full text-left">
            <div className="flex gap-1.5">
              {log.images.slice(0, 3).map((image) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={image.id} src={image.url} alt="" className="size-12 rounded-md object-cover" />
              ))}
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-foreground">{log.prompt || log.title}</p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {log.model} · {log.imageCount} 张
            </p>
          </button>
          <div className="mt-1 flex justify-end opacity-0 transition group-hover:opacity-100">
            <Button size="small" type="text" danger icon={<Trash2 className="size-3.5" />} onClick={() => onDelete(log.id)} />
          </div>
        </div>
      ))}
    </div>
  );
}
