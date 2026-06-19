'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CaptchaBox, { type CaptchaBoxHandle } from './CaptchaBox';
import GenerationLoader from './GenerationLoader';
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
  const activeJobIdRef = useRef<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
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
  const [closing, setClosing] = useState(false);
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
      activeJobIdRef.current = null;
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
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
      submittedJobs.current.set(data.id, {
        prompt,
        modelId,
        modelName: selectedModel?.name || modelId,
        quality,
        aspectRatio,
      });
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
  const queueRank = jobState?.queue.queuePosition;
  const generationStatus = jobState?.job.status;
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
        <div className="command-hero">
          <div className="command-copy">
            <p className="eyebrow">AI Image Queue</p>
            <h1>
              {copy.title} {copy.freeGenerate}
            </h1>
            <p>{copy.heroTagline}</p>
          </div>

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
              <input
                id="prompt-command-input"
                className="prompt-command-input"
                type="text"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={copy.promptBarPlaceholder}
                maxLength={4000}
                disabled={closing}
              />
              <div className="command-selects">
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
                <label className="sr-only" htmlFor="aspect-command-select">
                  {copy.aspectRatioLabel}
                </label>
                <select
                  id="aspect-command-select"
                  value={aspectRatio}
                  onChange={(event) => setAspectRatio(event.target.value as ImageAspectRatio)}
                  aria-label={copy.aspectRatioLabel}
                  disabled={closing}
                >
                  {IMAGE_ASPECT_RATIOS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <button className="primary-button command-submit" type="submit" disabled={submitting || closing || !prompt.trim() || !models.length}>
                {submitting ? copy.submitting : copy.submit}
              </button>
            </div>

            <div className="secondary-controls">
              {models.length > 1 ? (
                <div className="model-list compact" role="radiogroup" aria-label={copy.modelLabel}>
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
                      <span className={`model-icon ${model.icon}`}>{iconLabel(model.icon)}</span>
                      <span>{model.name}</span>
                    </label>
                  ))}
                </div>
              ) : models.length === 1 && selectedModel ? (
                <div className="selected-model-label" aria-label={copy.modelLabel}>
                  <span className={`model-icon ${selectedModel.icon}`}>{iconLabel(selectedModel.icon)}</span>
                  <span>{selectedModel.name}</span>
                </div>
              ) : (
                <div className="notice error compact-notice">{copy.modelMissing}</div>
              )}

              {config?.priorityQueueEnabled ? (
                <label className="priority-toggle compact">
                  <input
                    type="checkbox"
                    checked={usePriority}
                    onChange={(event) => setUsePriority(event.target.checked)}
                    disabled={closing || (config.priorityRemaining || 0) <= 0}
                  />
                  <span>
                    {copy.priorityLabel}
                    <small>{copy.priorityHint.replace('{count}', String(config.priorityRemaining || 0))}</small>
                  </span>
                </label>
              ) : null}
            </div>

            {error ? <div className="notice error command-error">{error}</div> : null}
          </form>

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
