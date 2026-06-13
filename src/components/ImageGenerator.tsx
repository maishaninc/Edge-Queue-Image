'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CaptchaBox, { type CaptchaBoxHandle } from './CaptchaBox';
import type { CaptchaProvider } from '@/lib/config';
import { COPY, type SiteLocale } from '@/lib/i18n';
import { IMAGE_ASPECT_RATIOS, IMAGE_QUALITIES, type ImageAspectRatio, type ImageQuality } from '@/lib/image-options';
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

const STATUS_LABELS: Record<JobStatus, StringCopyKey> = {
  queued: 'statusQueued',
  running: 'statusRunning',
  succeeded: 'statusSucceeded',
  failed: 'statusFailed',
  expired: 'statusExpired',
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
};

function errorMessage(copy: (typeof COPY)['zh-CN'], code: string) {
  return copy[ERROR_MESSAGES[code] || 'databaseUnavailable'];
}

function iconLabel(icon: string) {
  const labels: Record<string, string> = {
    openai: 'OA',
    flux: 'FX',
    seedream: 'SD',
    google: 'G',
    stable: 'ST',
    model: 'AI',
  };
  return labels[icon] || labels.model;
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

export default function ImageGenerator({ locale }: { locale: SiteLocale }) {
  const copy = COPY[locale];
  const captchaRef = useRef<CaptchaBoxHandle>(null);
  const savedJobIds = useRef(new Set<string>());
  const submittedJobs = useRef(
    new Map<
      string,
      {
        prompt: string;
        modelId: string;
        modelName: string;
        quality: ImageQuality;
        aspectRatio: ImageAspectRatio;
      }
    >(),
  );

  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [models, setModels] = useState<PublicModel[]>([]);
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState('default');
  const [quality, setQuality] = useState<ImageQuality>('1K');
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('1:1');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [usePriority, setUsePriority] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobState, setJobState] = useState<JobResponse | null>(null);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyPreview, setHistoryPreview] = useState<{ item: HistoryItem; url: string } | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/config').then((response) => response.json()),
      fetch('/api/models').then((response) => response.json()),
    ])
      .then(([runtime, modelData]) => {
        setConfig(runtime);
        const nextModels = Array.isArray(modelData.models) ? modelData.models : [];
        setModels(nextModels);
        if (nextModels[0]) {
          setModelId(nextModels[0].id);
        }
      })
      .catch(() => setError(copy.databaseUnavailable));
  }, [copy.databaseUnavailable]);

  const refreshHistory = useCallback(() => {
    if (!('indexedDB' in window)) return;
    listHistoryItems()
      .then(setHistory)
      .catch(() => setHistoryError(copy.historyUnavailable));
  }, [copy.historyUnavailable]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

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
    setJobState(data);
  }, []);

  useEffect(() => {
    if (!jobId || !config) return;
    let cancelled = false;
    const currentJobId = jobId;

    async function tick() {
      try {
        await loadJob(currentJobId);
      } catch (err) {
        if (!cancelled) {
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
      setJobId(data.id);
      setJobState(null);
      submittedJobs.current.set(data.id, {
        prompt,
        modelId,
        modelName: selectedModel?.name || modelId,
        quality,
        aspectRatio,
      });
      setCaptchaOpen(false);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'database_unavailable';
      setError(errorMessage(copy, code));
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
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function reuseHistory(item: HistoryItem) {
    setPrompt(item.prompt);
    setModelId(item.modelId);
    setQuality(item.quality);
    setAspectRatio(item.aspectRatio);
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
  const visibleHistory = historyExpanded ? history : history.slice(0, 4);

  return (
    <main className="workspace">
      <section className="hero-workspace" id="generator">
        <div className="intro">
          <p className="eyebrow">AI Image Queue</p>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>

        <section className="tool-grid">
          <form
            className="panel generator-panel"
            onSubmit={(event) => {
              event.preventDefault();
              requestSubmit();
            }}
          >
            <label className="field prompt-field">
              <span>{copy.promptLabel}</span>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={copy.promptPlaceholder} rows={3} maxLength={4000} />
            </label>

            <div className="model-list" role="radiogroup" aria-label={copy.modelLabel}>
              {models.length ? (
                models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    className={`model-chip${modelId === model.id ? ' active' : ''}`}
                    onClick={() => setModelId(model.id)}
                    aria-pressed={modelId === model.id}
                  >
                    <span className={`model-icon ${model.icon}`}>{iconLabel(model.icon)}</span>
                    <span>{model.name}</span>
                  </button>
                ))
              ) : (
                <div className="notice error">{copy.modelMissing}</div>
              )}
            </div>

            <div className="option-row">
              <div>
                <span className="option-label">{copy.qualityLabel}</span>
                <div className="segmented">
                  {IMAGE_QUALITIES.map((item) => (
                    <button key={item} type="button" className={quality === item ? 'active' : ''} onClick={() => setQuality(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="option-label">{copy.aspectRatioLabel}</span>
                <div className="segmented">
                  {IMAGE_ASPECT_RATIOS.map((item) => (
                    <button key={item} type="button" className={aspectRatio === item ? 'active' : ''} onClick={() => setAspectRatio(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {config?.priorityQueueEnabled ? (
              <label className="priority-toggle">
                <input
                  type="checkbox"
                  checked={usePriority}
                  onChange={(event) => setUsePriority(event.target.checked)}
                  disabled={(config.priorityRemaining || 0) <= 0}
                />
                <span>
                  {copy.priorityLabel}
                  <small>{copy.priorityHint.replace('{count}', String(config.priorityRemaining || 0))}</small>
                </span>
              </label>
            ) : null}

            {error ? <div className="notice error">{error}</div> : null}

            <button className="primary-button" type="submit" disabled={submitting || !prompt.trim() || !models.length}>
              {submitting ? copy.submitting : copy.submit}
            </button>
          </form>

          <aside className="panel status-panel">
            <div className="panel-heading">
              <p className="eyebrow">{copy.queueTitle}</p>
              <h2>{jobState ? copy[STATUS_LABELS[jobState.job.status]] : copy.idleTitle}</h2>
            </div>

            {!jobState ? (
              <p className="muted">{copy.idleDescription}</p>
            ) : (
              <>
                <div className="metrics-grid">
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

                {countdown ? <div className="notice ttl">{copy.ttlNotice.replace('{time}', countdown)}</div> : null}

                {jobState.job.status === 'failed' || jobState.job.status === 'expired' ? (
                  <div className="notice error">{jobState.job.errorMessage || copy.providerFailed}</div>
                ) : null}

                {resultSrc ? (
                  <div className="result-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resultSrc} alt={copy.resultAlt} />
                    <div className="result-actions">
                      <a className="secondary-button" href={resultSrc} download>
                        {copy.download}
                      </a>
                      {jobState.job.resultUrl ? (
                        <button className="secondary-button" type="button" onClick={copyResultUrl}>
                          {copied ? copy.copied : copy.copyUrl}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setJobId(null);
                    setJobState(null);
                    setError('');
                  }}
                >
                  {copy.again}
                </button>
              </>
            )}
          </aside>
        </section>
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
              {history.length > 4 ? (
                <button className="secondary-button" type="button" onClick={() => setHistoryExpanded((value) => !value)}>
                  {historyExpanded ? copy.collapseHistory : copy.expandHistory}
                </button>
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
