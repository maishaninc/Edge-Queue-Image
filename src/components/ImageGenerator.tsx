'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OpenAI } from '@lobehub/icons';
import CaptchaBox, { type CaptchaBoxHandle } from './CaptchaBox';
import GenerationLoader from './GenerationLoader';
import type { CaptchaProvider } from '@/lib/config';
import { COPY, type SiteLocale } from '@/lib/i18n';
import { IMAGE_QUALITIES, type ImageAspectRatio, type ImageQuality } from '@/lib/image-options';
import { PROMPT_GALLERY_ITEMS, proxiedGithubImageUrl, type PromptGalleryItem } from '@/lib/prompt-gallery';
import {
  base64ToBlob,
  clearHistoryItems,
  deleteHistoryItem,
  imageUrlToBlob,
  listHistoryItems,
  saveHistoryItem,
  type HistoryItem,
} from '@/lib/history-store';

type PublicModel = {
  id: string;
  name: string;
  icon: string;
};

type RuntimeConfig = {
  captchaProvider: CaptchaProvider;
  captchaSiteKey: string;
  priorityQueueEnabled: boolean;
  priorityDailyLimit: number;
  priorityRemaining: number;
  queuePollIntervalMs: number;
  jobResultTtlMinutes: number;
  zhCnImageProxyEnabled: boolean;
};

type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'expired';

type JobResponse = {
  job: {
    id: string;
    status: JobStatus;
    modelId: string;
    isPriority: boolean;
    quality: ImageQuality;
    aspectRatio: ImageAspectRatio;
    expiresAt: string | null;
    resultUrl: string | null;
    resultB64: string | null;
    errorCode: string | null;
    errorMessage: string | null;
  };
  queue: {
    runningCount: number;
    waitingCount: number;
    queuePosition: number | null;
  };
};

type StringCopyKey = {
  [Key in keyof typeof COPY['zh-CN']]: (typeof COPY)['zh-CN'][Key] extends string ? Key : never;
}[keyof typeof COPY['zh-CN']];

const ACTIVE_JOB_STORAGE_KEY = 'aivro-active-generation-job';
const FIXED_ASPECT_RATIO: ImageAspectRatio = '1:1';
const HISTORY_PAGE_SIZE = 8;

type SubmittedJobSnapshot = {
  prompt: string;
  modelId: string;
  modelName: string;
  quality: ImageQuality;
  aspectRatio: ImageAspectRatio;
};

type StoredActiveJob = SubmittedJobSnapshot & {
  id: string;
};

const ERROR_MESSAGES: Record<string, StringCopyKey> = {
  queue_full: 'queueFull',
  captcha_failed: 'captchaInvalid',
  captcha_missing: 'captchaMissing',
  captcha_secret_missing: 'captchaSecretMissing',
  captcha_unreachable: 'captchaUnreachable',
  captcha_invalid: 'captchaInvalid',
  priority_limit_reached: 'priorityLimit',
  model_not_found: 'modelMissing',
  invalid_prompt: 'invalidPrompt',
  invalid_image_options: 'invalidImageOptions',
  database_unavailable: 'databaseUnavailable',
  provider_failed: 'providerFailed',
  job_not_found: 'jobExpired',
  rate_limited: 'queueFull',
};

function errorMessage(copy: (typeof COPY)['zh-CN'], code: string) {
  return copy[ERROR_MESSAGES[code] || 'databaseUnavailable'];
}

function fallbackIconLabel(icon: string) {
  const labels: Record<string, string> = {
    flux: 'FX',
    seedream: 'SD',
    google: 'G',
    stable: 'ST',
    model: 'AI',
  };
  return labels[icon] || labels.model;
}

function ModelIcon({ icon }: { icon: string }) {
  if (icon === 'openai') {
    return (
      <span className="model-icon openai" aria-hidden="true">
        <OpenAI size={16} />
      </span>
    );
  }

  return <span className={`model-icon ${icon}`}>{fallbackIconLabel(icon)}</span>;
}

function formatCountdown(expiresAt: string | null, now: number) {
  if (!expiresAt) return '';
  const remaining = new Date(expiresAt).getTime() - now;
  if (remaining <= 0) return '00:00';
  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function blobUrlFor(item: HistoryItem) {
  return URL.createObjectURL(item.imageBlob);
}

function readStoredActiveJob(): StoredActiveJob | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
  if (!raw) return null;

  try {
    const stored = JSON.parse(raw) as Partial<StoredActiveJob>;
    if (!stored.id || !stored.prompt || !stored.modelId) return null;
    return {
      id: stored.id,
      prompt: stored.prompt,
      modelId: stored.modelId,
      modelName: stored.modelName || stored.modelId,
      quality: stored.quality || '1K',
      aspectRatio: FIXED_ASPECT_RATIO,
    };
  } catch {
    window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
    return null;
  }
}

function PromptGallery({ locale, proxyEnabled, leaving, onCite }: { locale: SiteLocale; proxyEnabled: boolean; leaving: boolean; onCite: (title: string) => void }) {
  const [previewItem, setPreviewItem] = useState<PromptGalleryItem | null>(null);
  const shouldProxy = locale === 'zh-CN' && proxyEnabled;
  const rows = [PROMPT_GALLERY_ITEMS.slice(0, 7), PROMPT_GALLERY_ITEMS.slice(7, 14), PROMPT_GALLERY_ITEMS.slice(14)];
  const heading =
    locale === 'zh-CN'
      ? { eyebrow: 'Prompt Gallery', title: '最新 GPT Image 2 灵感图库', description: '内置 YouMind 最大 Prompt Gallery 的最新 20 个图片参考，结合社区精选、仓库导航和 API 商业案例方向做展示。', more: '更多' }
      : { eyebrow: 'Prompt Gallery', title: 'Fresh GPT Image 2 prompt references', description: 'A built-in stream of the latest 20 visual references from the YouMind prompt gallery.', more: 'More' };

  function imgSrc(url: string) { return proxiedGithubImageUrl(url, shouldProxy); }
  function imgFallback(e: React.SyntheticEvent<HTMLImageElement>) {
    const el = e.currentTarget; el.onerror = null; el.src = proxiedGithubImageUrl(el.src, true);
  }

  return (
    <section className={`prompt-gallery${leaving ? ' leaving' : ''}`} aria-label={heading.title}>
      <div className="gallery-heading">
        <p className="eyebrow">{heading.eyebrow}</p>
        <h1>{heading.title}</h1>
        <p>{heading.description}</p>
        <a className="secondary-button gallery-more" href="https://github.com/YouMind-OpenLab/awesome-gpt-image-2" target="_blank" rel="noopener noreferrer">{heading.more}</a>
      </div>
      <div className="gallery-viewport">
        {rows.map((rowItems, rowIndex) => (
          <div key={rowIndex} className={`gallery-track${rowIndex === 1 ? ' reverse' : ''}`}>
            {[...rowItems, ...rowItems].map((item, index) => (
              <article className={`gallery-card ${item.aspect}`} key={`${item.id}-${index}`} onDoubleClick={() => setPreviewItem(item)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc(item.imageUrl)} alt={item.title} loading={index < 4 ? 'eager' : 'lazy'} onError={imgFallback} />
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.source}</span>
                </div>
              </article>
            ))}
          </div>
        ))}
      </div>

      {previewItem ? (
        <div className="modal-overlay" role="presentation" onClick={() => setPreviewItem(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{locale === 'zh-CN' ? '提示词参考' : 'Prompt Reference'}</h2>
                <p>{previewItem.source}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setPreviewItem(null)} aria-label="close">×</button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="preview-image" src={imgSrc(previewItem.imageUrl)} alt={previewItem.title} onError={imgFallback} />
            <p className="preview-prompt">{previewItem.title}</p>
            <div className="modal-actions">
              <button className="primary-button compact" type="button" onClick={() => { onCite(previewItem.title); setPreviewItem(null); }}>
                {locale === 'zh-CN' ? '一键引用' : 'Use as prompt'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function ImageGenerator({ locale }: { locale: SiteLocale }) {
  const copy = COPY[locale];
  const [initialActiveJob] = useState<StoredActiveJob | null>(() => readStoredActiveJob());
  const captchaRef = useRef<CaptchaBoxHandle>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const savedJobIds = useRef(new Set<string>());
  const submittedJobs = useRef(new Map<string, SubmittedJobSnapshot>());

  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [models, setModels] = useState<PublicModel[]>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [prompt, setPrompt] = useState(initialActiveJob?.prompt || '');
  const [modelId, setModelId] = useState(initialActiveJob?.modelId || 'default');
  const [quality, setQuality] = useState<ImageQuality>(initialActiveJob?.quality || '1K');
  const [aspectRatio] = useState<ImageAspectRatio>(FIXED_ASPECT_RATIO);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [usePriority, setUsePriority] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(initialActiveJob?.id || null);
  const [jobState, setJobState] = useState<JobResponse | null>(null);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyPreview, setHistoryPreview] = useState<{ item: HistoryItem; url: string } | null>(null);
  const [historyPage, setHistoryPage] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch('/api/config').then((response) => response.json()),
      fetch('/api/models').then((response) => response.json()),
    ])
      .then(([runtime, modelData]) => {
        setConfig(runtime);
        const nextModels = Array.isArray(modelData.models) ? modelData.models : [];
        setModels(nextModels);
        setModelsLoaded(true);
        setModelId((current) => (nextModels[0] && !nextModels.some((model: PublicModel) => model.id === current) ? nextModels[0].id : current));
      })
      .catch(() => {
        setModelsLoaded(true);
        setError(copy.databaseUnavailable);
      });
  }, [copy.databaseUnavailable]);

  useEffect(() => {
    if (!initialActiveJob) return;
    submittedJobs.current.set(initialActiveJob.id, {
      prompt: initialActiveJob.prompt,
      modelId: initialActiveJob.modelId,
      modelName: initialActiveJob.modelName,
      quality: initialActiveJob.quality,
      aspectRatio: FIXED_ASPECT_RATIO,
    });
    activeJobIdRef.current = initialActiveJob.id;
  }, [initialActiveJob]);

  const refreshHistory = useCallback(() => {
    if (!('indexedDB' in window)) return;
    listHistoryItems()
      .then((items) => {
        setHistory(items);
        setHistoryPage((page) => Math.min(page, Math.max(0, Math.ceil(items.length / HISTORY_PAGE_SIZE) - 1)));
      })
      .catch(() => setHistoryError(copy.historyUnavailable));
  }, [copy.historyUnavailable]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const node = promptInputRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  }, [prompt]);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    return () => {
      activeJobIdRef.current = null;
      window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const status = jobState?.job.status;
    if (status === 'succeeded' || status === 'failed' || status === 'expired') {
      window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
    }
  }, [jobState]);

  useEffect(() => {
    return () => {
      if (historyPreview) URL.revokeObjectURL(historyPreview.url);
    };
  }, [historyPreview]);

  const selectedModel = useMemo(() => models.find((model) => model.id === modelId), [modelId, models]);

  const resultSrc = useMemo(() => {
    const job = jobState?.job;
    if (!job) return '';
    if (job.resultUrl) return job.resultUrl;
    if (job.resultB64) return `data:image/png;base64,${job.resultB64}`;
    return '';
  }, [jobState]);

  const loadJob = useCallback(async (id: string) => {
    const response = await fetch(`/api/jobs/${id}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'database_unavailable');
    }
    return data as JobResponse;
  }, []);

  useEffect(() => {
    if (!jobId || !config) return;
    let cancelled = false;
    const currentJobId = jobId;

    async function tick() {
      try {
        const data = await loadJob(currentJobId);
        if (!cancelled && activeJobIdRef.current === currentJobId && data.job.id === currentJobId) {
          setJobState(data);
        }
      } catch (err) {
        if (!cancelled && activeJobIdRef.current === currentJobId) {
          const code = err instanceof Error ? err.message : 'database_unavailable';
          setError(errorMessage(copy, code));
        }
      }
    }

    tick();
    const timer = window.setInterval(tick, config.queuePollIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [config, copy, jobId, loadJob]);

  useEffect(() => {
    const job = jobState?.job;
    if (!job || job.status !== 'succeeded' || savedJobIds.current.has(job.id)) return;

    async function persistHistory() {
      if (!job) return;
      try {
        let imageBlob: Blob;
        let sourceType: 'url' | 'b64';
        if (job.resultB64) {
          imageBlob = base64ToBlob(job.resultB64);
          sourceType = 'b64';
        } else if (job.resultUrl) {
          imageBlob = await imageUrlToBlob(job.resultUrl);
          sourceType = 'url';
        } else {
          return;
        }

        const snapshot = submittedJobs.current.get(job.id);
        await saveHistoryItem({
          id: crypto.randomUUID(),
          jobId: job.id,
          prompt: snapshot?.prompt || prompt,
          modelId: snapshot?.modelId || job.modelId,
          modelName: snapshot?.modelName || selectedModel?.name || job.modelId,
          quality: snapshot?.quality || job.quality,
          aspectRatio: snapshot?.aspectRatio || job.aspectRatio,
          createdAt: new Date().toISOString(),
          isPriority: job.isPriority,
          imageBlob,
          mimeType: imageBlob.type || 'image/png',
          sourceType,
        });
        savedJobIds.current.add(job.id);
        refreshHistory();
      } catch {
        setHistoryError(copy.historySaveFailed);
        savedJobIds.current.add(job.id);
      }
    }

    persistHistory();
  }, [copy.historySaveFailed, jobState, prompt, refreshHistory, selectedModel]);

  function resetActiveJob() {
    activeJobIdRef.current = null;
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (copiedTimerRef.current) {
      window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = null;
    }
    setJobId(null);
    setJobState(null);
    setError('');
    setCopied(false);
    setClosing(false);
  }

  async function submitWithToken(token: string) {
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt,
          modelId,
          captchaToken: token,
          usePriority,
          quality,
          aspectRatio,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'database_unavailable');
      }
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
      activeJobIdRef.current = null;
      setClosing(true);
      setJobId(null);
      setJobState(null);
      const snapshot: SubmittedJobSnapshot = {
        prompt,
        modelId,
        modelName: selectedModel?.name || modelId,
        quality,
        aspectRatio: FIXED_ASPECT_RATIO,
      };
      submittedJobs.current.set(data.id, snapshot);
      window.localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, JSON.stringify({ id: data.id, ...snapshot }));
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const closeDelay = reducedMotion ? 0 : 360;
      closeTimerRef.current = window.setTimeout(() => {
        activeJobIdRef.current = data.id;
        setJobId(data.id);
        setClosing(false);
        closeTimerRef.current = null;
      }, closeDelay);
      setCaptchaOpen(false);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'database_unavailable';
      setError(errorMessage(copy, code));
      activeJobIdRef.current = null;
      setClosing(false);
    } finally {
      setSubmitting(false);
      setCaptchaToken('');
      captchaRef.current?.reset();
    }
  }

  function requestSubmit() {
    if (!prompt.trim() || !models.length) return;
    if (!config || config.captchaProvider === 'none') {
      submitWithToken('');
      return;
    }
    setError('');
    setCaptchaToken('');
    captchaRef.current?.reset();
    setCaptchaOpen(true);
  }

  async function copyResultUrl() {
    const url = jobState?.job.resultUrl;
    if (!url) return;
    await navigator.clipboard.writeText(url);
    if (copiedTimerRef.current) {
      window.clearTimeout(copiedTimerRef.current);
    }
    setCopied(true);
    copiedTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      copiedTimerRef.current = null;
    }, 1600);
  }

  function reuseHistory(item: HistoryItem) {
    setPrompt(item.prompt);
    setModelId(item.modelId);
    setQuality(item.quality);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function previewHistory(item: HistoryItem) {
    setHistoryPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { item, url: blobUrlFor(item) };
    });
  }

  async function removeHistory(id: string) {
    await deleteHistoryItem(id);
    refreshHistory();
  }

  async function clearHistory() {
    if (!window.confirm(copy.historyClearConfirm)) return;
    await clearHistoryItems();
    refreshHistory();
  }

  const countdown = now ? formatCountdown(jobState?.job.expiresAt || null, now) : '';
  const historyPageCount = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const visibleHistory = history.slice(historyPage * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE);
  const queueRank = jobState?.queue.queuePosition;
  const generationStatus = jobState?.job.status;
  const isGeneratingView = Boolean(jobId);
  const generationError =
    jobState?.job.errorMessage ||
    (jobState?.job.errorCode ? errorMessage(copy, jobState.job.errorCode) : copy.providerFailed);
  const generationTitle =
    generationStatus === 'queued'
      ? copy.queueWaitingTitle
      : generationStatus === 'running'
        ? copy.generatingTitle
        : generationStatus === 'succeeded'
          ? copy.statusSucceeded
          : generationStatus === 'failed'
            ? copy.statusFailed
            : generationStatus === 'expired'
              ? copy.statusExpired
              : copy.startingTitle;
  const showGenerationStage = Boolean(jobId);

  return (
    <main className="workspace">
      <section className="hero-workspace" id="generator">
        <div className={`command-hero${isGeneratingView ? ' generating' : ''}`}>
          {!isGeneratingView ? <PromptGallery locale={locale} proxyEnabled={Boolean(config?.zhCnImageProxyEnabled)} leaving={closing} onCite={(title) => { setPrompt(title); window.scrollTo({ top: 0, behavior: 'smooth' }); }} /> : null}

          {!isGeneratingView ? (
            <form
              className="command-form"
              onSubmit={(event) => {
                event.preventDefault();
                requestSubmit();
              }}
            >
              <div className={`prompt-command-bar${closing ? ' closing' : ''}`}>
                <label className="sr-only" htmlFor="prompt-command-input">
                  {copy.promptLabel}
                </label>
                <textarea
                  id="prompt-command-input"
                  ref={promptInputRef}
                  className="prompt-command-input"
                  value={prompt}
                  rows={1}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      requestSubmit();
                    }
                  }}
                  placeholder={copy.promptBarPlaceholder}
                  maxLength={4000}
                  disabled={closing}
                />
              </div>

              <div className="command-controls">
                <label className="sr-only" htmlFor="quality-command-select">
                  {copy.qualityLabel}
                </label>
                <select
                  id="quality-command-select"
                  value={quality}
                  onChange={(event) => setQuality(event.target.value as ImageQuality)}
                  aria-label={copy.qualityLabel}
                  disabled={closing}
                >
                  {IMAGE_QUALITIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <div className="fixed-ratio" aria-label={copy.aspectRatioLabel}>
                  {aspectRatio}
                </div>

                {config?.priorityQueueEnabled ? (
                  <label className="priority-inline" title={copy.priorityHint.replace('{count}', String(config.priorityRemaining || 0))}>
                    <input
                      type="checkbox"
                      checked={usePriority}
                      onChange={(event) => setUsePriority(event.target.checked)}
                      disabled={closing || (config.priorityRemaining || 0) <= 0}
                    />
                    <span>{copy.priorityLabel}</span>
                  </label>
                ) : null}

                {models.length > 1 ? (
                  <div className="model-list compact inline-models" role="radiogroup" aria-label={copy.modelLabel}>
                    {models.map((model) => (
                      <label key={model.id} className={`model-chip${modelId === model.id ? ' active' : ''}`}>
                        <input
                          className="sr-only"
                          type="radio"
                          name="image-model"
                          value={model.id}
                          checked={modelId === model.id}
                          onChange={() => setModelId(model.id)}
                          disabled={closing}
                        />
                        <ModelIcon icon={model.icon} />
                        <span>{model.name}</span>
                      </label>
                    ))}
                  </div>
                ) : models.length === 1 && selectedModel ? (
                  <div className="selected-model-label inline-model" aria-label={copy.modelLabel}>
                    <ModelIcon icon={selectedModel.icon} />
                    <span>{selectedModel.name}</span>
                  </div>
                ) : modelsLoaded ? (
                  <div className="notice error compact-notice">{copy.modelMissing}</div>
                ) : (
                  <div className="selected-model-label inline-model skeleton-model" aria-label={copy.modelLabel} />
                )}

                <button className="primary-button command-submit" type="submit" disabled={submitting || closing || !prompt.trim() || !models.length}>
                  {submitting ? copy.submitting : copy.submit}
                </button>
              </div>

              {error ? <div className="notice error command-error">{error}</div> : null}
            </form>
          ) : null}

          {showGenerationStage ? (
            <section className="panel generation-stage" aria-live="polite">
              <div className="generation-stage-main">
                <p className="eyebrow">{copy.queueTitle}</p>
                <h2>{generationTitle}</h2>

                {generationStatus === 'queued' ? (
                  queueRank ? <p className="generation-status-copy">{copy.queueRankText.replace('{rank}', String(queueRank))}</p> : null
                ) : null}

                {generationStatus === 'running' ? (
                  <div className="generation-running">
                    <GenerationLoader className="status-loader" />
                    <p className="generation-status-copy">{copy.generatingHint}</p>
                  </div>
                ) : null}

                {generationStatus === 'succeeded' && resultSrc ? (
                  <div className="result-block generation-result">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resultSrc} alt={copy.resultAlt} />
                    {countdown ? <div className="notice ttl">{copy.ttlNotice.replace('{time}', countdown)}</div> : null}
                    <div className="result-actions">
                      <a className="secondary-button" href={resultSrc} download>
                        {copy.download}
                      </a>
                      {jobState?.job.resultUrl ? (
                        <button className="secondary-button" type="button" onClick={copyResultUrl}>
                          {copied ? copy.copied : copy.copyUrl}
                        </button>
                      ) : null}
                      <button className="primary-button compact" type="button" onClick={resetActiveJob}>
                        {copy.again}
                      </button>
                    </div>
                  </div>
                ) : null}

                {generationStatus === 'failed' || generationStatus === 'expired' ? (
                  <>
                    <div className="notice error">{generationError}</div>
                    <button className="primary-button compact" type="button" onClick={resetActiveJob}>
                      {copy.again}
                    </button>
                  </>
                ) : null}

                {(generationStatus === 'queued' || generationStatus === 'running' || !jobState) && (
                  <button className="ghost-button generation-reset" type="button" onClick={resetActiveJob}>
                    {copy.again}
                  </button>
                )}
              </div>

              {jobState ? (
                <div className="metrics-grid generation-metrics" aria-label={copy.queueTitle}>
                  <div>
                    <span>{copy.queuePosition}</span>
                    <strong>{jobState.queue.queuePosition ?? '-'}</strong>
                  </div>
                  <div>
                    <span>{copy.runningCount}</span>
                    <strong>{jobState.queue.runningCount}</strong>
                  </div>
                  <div>
                    <span>{copy.waitingCount}</span>
                    <strong>{jobState.queue.waitingCount}</strong>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </section>

      <section className="history-section" id="history">
        <div className="section-heading">
          <p className="eyebrow">{copy.historyEyebrow}</p>
          <h2>{copy.historyTitle}</h2>
          <p>{copy.historyDescription}</p>
        </div>
        {historyError ? <div className="notice error">{historyError}</div> : null}
        {history.length ? (
          <>
            <div className="history-grid">
              {visibleHistory.map((item) => {
                const thumb = blobUrlFor(item);
                return (
                  <article className="history-card" key={item.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb} alt={copy.historyImageAlt} onLoad={() => URL.revokeObjectURL(thumb)} />
                    <div>
                      <strong>{item.modelName}</strong>
                      <span>
                        {item.quality} · {item.aspectRatio}
                      </span>
                    </div>
                    <p>{item.prompt}</p>
                    <div className="history-actions">
                      <button type="button" onClick={() => previewHistory(item)}>
                        {copy.preview}
                      </button>
                      <button type="button" onClick={() => reuseHistory(item)}>
                        {copy.reuse}
                      </button>
                      <button type="button" onClick={() => removeHistory(item.id)}>
                        {copy.delete}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="history-toolbar">
              {history.length > HISTORY_PAGE_SIZE ? (
                <div className="history-pager" aria-label={copy.historyTitle}>
                  <button className="secondary-button" type="button" onClick={() => setHistoryPage((page) => Math.max(0, page - 1))} disabled={historyPage === 0}>
                    上一页
                  </button>
                  <span>
                    {historyPage + 1} / {historyPageCount}
                  </span>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setHistoryPage((page) => Math.min(historyPageCount - 1, page + 1))}
                    disabled={historyPage >= historyPageCount - 1}
                  >
                    下一页
                  </button>
                </div>
              ) : null}
              <button className="secondary-button" type="button" onClick={clearHistory}>
                {copy.clearHistory}
              </button>
            </div>
          </>
        ) : (
          <p className="muted">{copy.historyEmpty}</p>
        )}
      </section>

      <section className="features-section" id="features">
        <div className="section-heading">
          <p className="eyebrow">{copy.featuresEyebrow}</p>
          <h2>{copy.featuresTitle}</h2>
        </div>
        <div className="feature-grid">
          {copy.features.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="compare-section" id="compare">
        <div className="section-heading">
          <p className="eyebrow">{copy.compareEyebrow}</p>
          <h2>{copy.compareTitle}</h2>
        </div>
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>{copy.compareFeature}</th>
                <th>Aivro</th>
                <th>{copy.compareOther}</th>
              </tr>
            </thead>
            <tbody>
              {copy.compareRows.map((row) => (
                <tr key={row.feature}>
                  <td>{row.feature}</td>
                  <td>{row.aivro}</td>
                  <td>{row.other}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="faq-section" id="faq">
        <div className="section-heading">
          <p className="eyebrow">Q&A</p>
          <h2>{copy.faqTitle}</h2>
        </div>
        <div className="faq-list">
          {copy.faq.map((item) => (
            <details className="faq-item" key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {captchaOpen && config ? (
        <div className="modal-overlay" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="captcha-title">
            <div className="modal-header">
              <div>
                <h2 id="captcha-title">{copy.captchaTitle}</h2>
                <p>{copy.captchaDescription}</p>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => {
                  setCaptchaOpen(false);
                  setCaptchaToken('');
                  captchaRef.current?.reset();
                }}
                aria-label={copy.close}
              >
                x
              </button>
            </div>
            <CaptchaBox ref={captchaRef} provider={config.captchaProvider} siteKey={config.captchaSiteKey} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} />
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setCaptchaOpen(false)}>
                {copy.cancel}
              </button>
              <button className="primary-button compact" type="button" disabled={submitting || !captchaToken} onClick={() => submitWithToken(captchaToken)}>
                {submitting ? copy.submitting : copy.confirmGenerate}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {historyPreview ? (
        <div className="modal-overlay" role="presentation">
          <div className="modal-card preview-card" role="dialog" aria-modal="true" aria-labelledby="history-preview-title">
            <div className="modal-header">
              <div>
                <h2 id="history-preview-title">{copy.preview}</h2>
                <p>
                  {historyPreview.item.modelName} · {historyPreview.item.quality} · {historyPreview.item.aspectRatio}
                </p>
              </div>
              <button className="icon-button" type="button" onClick={() => setHistoryPreview(null)} aria-label={copy.close}>
                x
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="preview-image" src={historyPreview.url} alt={copy.historyImageAlt} />
            <p className="preview-prompt">{historyPreview.item.prompt}</p>
            <div className="modal-actions">
              <a className="secondary-button" href={historyPreview.url} download>
                {copy.download}
              </a>
              <button className="primary-button compact" type="button" onClick={() => reuseHistory(historyPreview.item)}>
                {copy.reuse}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
