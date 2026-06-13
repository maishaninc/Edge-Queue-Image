'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import CaptchaBox from './CaptchaBox';
import type { CaptchaProvider } from '@/lib/config';
import { COPY, type SiteLocale } from '@/lib/i18n';

type PublicModel = {
  id: string;
  name: string;
};

type RuntimeConfig = {
  captchaProvider: CaptchaProvider;
  captchaSiteKey: string;
  priorityQueueEnabled: boolean;
  priorityDailyLimit: number;
  priorityRemaining: number;
  queuePollIntervalMs: number;
};

type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'expired';

type JobResponse = {
  job: {
    id: string;
    status: JobStatus;
    modelId: string;
    isPriority: boolean;
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

const STATUS_LABELS: Record<JobStatus, keyof typeof COPY['zh-CN']> = {
  queued: 'statusQueued',
  running: 'statusRunning',
  succeeded: 'statusSucceeded',
  failed: 'statusFailed',
  expired: 'statusExpired',
};

const ERROR_MESSAGES: Record<string, keyof typeof COPY['zh-CN']> = {
  queue_full: 'queueFull',
  captcha_failed: 'captchaFailed',
  priority_limit_reached: 'priorityLimit',
  model_not_found: 'modelMissing',
  invalid_prompt: 'invalidPrompt',
  database_unavailable: 'databaseUnavailable',
  provider_failed: 'providerFailed',
};

export default function ImageGenerator({ locale }: { locale: SiteLocale }) {
  const copy = COPY[locale];
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [models, setModels] = useState<PublicModel[]>([]);
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState('default');
  const [captchaToken, setCaptchaToken] = useState('');
  const [usePriority, setUsePriority] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobState, setJobState] = useState<JobResponse | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

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
          setError(copy[ERROR_MESSAGES[code] || 'databaseUnavailable']);
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

  const resultSrc = useMemo(() => {
    const job = jobState?.job;
    if (!job) return '';
    if (job.resultUrl) return job.resultUrl;
    if (job.resultB64) return `data:image/png;base64,${job.resultB64}`;
    return '';
  }, [jobState]);

  async function submit() {
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt,
          modelId,
          captchaToken,
          usePriority,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'database_unavailable');
      }
      setJobId(data.id);
      setJobState(null);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'database_unavailable';
      setError(copy[ERROR_MESSAGES[code] || 'databaseUnavailable']);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyResultUrl() {
    const url = jobState?.job.resultUrl;
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="workspace">
      <section className="intro">
        <p className="eyebrow">Edge Queue Image</p>
        <h1>{copy.title}</h1>
        <p>{copy.subtitle}</p>
      </section>

      <section className="tool-grid">
        <form
          className="panel generator-panel"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="field">
            <span>{copy.promptLabel}</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={copy.promptPlaceholder} rows={8} maxLength={4000} />
          </label>

          <div className="form-row">
            <label className="field">
              <span>{copy.modelLabel}</span>
              <select value={modelId} onChange={(event) => setModelId(event.target.value)} disabled={!models.length}>
                {models.length ? (
                  models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))
                ) : (
                  <option>{copy.modelMissing}</option>
                )}
              </select>
            </label>
            <label className="field">
              <span>{copy.sizeLabel}</span>
              <select defaultValue="1024x1024" disabled>
                <option value="1024x1024">1024 x 1024</option>
              </select>
            </label>
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

          {config ? <CaptchaBox provider={config.captchaProvider} siteKey={config.captchaSiteKey} onVerify={setCaptchaToken} /> : null}

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

              {jobState.job.status === 'failed' || jobState.job.status === 'expired' ? (
                <div className="notice error">{jobState.job.errorMessage || copy.providerFailed}</div>
              ) : null}

              {resultSrc ? (
                <div className="result-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resultSrc} alt="Generated result" />
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
    </main>
  );
}
