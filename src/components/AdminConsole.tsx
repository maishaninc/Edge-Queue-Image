'use client';

import { FormEvent, useState } from 'react';

type AdminModel = {
  id: string;
  name: string;
  api: string;
  key: string;
};

type AdminSettings = {
  models: AdminModel[];
  queue: {
    concurrency: number;
    maxWaiting: number;
    pollIntervalMs: number;
    runningJobTimeoutSeconds: number;
    priorityQueueEnabled: boolean;
    priorityDailyLimit: number;
    jobResultTtlMinutes: number;
  };
  captcha: {
    provider: 'none' | 'turnstile' | 'hcaptcha';
    turnstileSiteKey: string;
    turnstileSecretKey: string;
    hcaptchaSiteKey: string;
    hcaptchaSecretKey: string;
  };
  ipHashSalt: string;
  csrfToken?: string;
};

type AdminConsoleProps = {
  configured: boolean;
  initialAuthenticated: boolean;
  initialSettings: AdminSettings | null;
};

const emptySettings: AdminSettings = {
  models: [{ id: 'default', name: '', api: '', key: '' }],
  queue: {
    concurrency: 1,
    maxWaiting: 200,
    pollIntervalMs: 3000,
    runningJobTimeoutSeconds: 300,
    priorityQueueEnabled: true,
    priorityDailyLimit: 1,
    jobResultTtlMinutes: 15,
  },
  captcha: {
    provider: 'none',
    turnstileSiteKey: '',
    turnstileSecretKey: '',
    hcaptchaSiteKey: '',
    hcaptchaSecretKey: '',
  },
  ipHashSalt: 'aivro-edge-queue-image',
};

function numberValue(value: string) {
  return Number.parseInt(value, 10) || 0;
}

export default function AdminConsole({ configured, initialAuthenticated, initialSettings }: AdminConsoleProps) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState('');
  const [settings, setSettings] = useState<AdminSettings>(initialSettings || emptySettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function loadSettings() {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/settings');
      const data = await response.json();
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }
      if (!response.ok) throw new Error(data.error || 'load_failed');
      setSettings(data.settings);
      setAuthenticated(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'load_failed');
    } finally {
      setLoading(false);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || 'login_failed');
      return;
    }
    setPassword('');
    await loadSettings();
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST', headers: { 'x-admin-csrf': settings.csrfToken || '' } });
    setAuthenticated(false);
  }

  async function save() {
    setSaving(true);
    setErrors({});
    setMessage('');
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-admin-csrf': settings.csrfToken || '' },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors(data.errors || {});
        setMessage(data.error || 'save_failed');
        return;
      }
      setSettings(data.settings);
      setMessage('Saved. New requests will use these settings.');
    } finally {
      setSaving(false);
    }
  }

  function updateModel(index: number, field: keyof AdminModel, value: string) {
    setSettings((current) => ({
      ...current,
      models: current.models.map((model, modelIndex) => (modelIndex === index ? { ...model, [field]: value } : model)),
    }));
  }

  function addModel() {
    setSettings((current) => ({
      ...current,
      models: [...current.models, { id: String(current.models.length), name: '', api: '', key: '' }],
    }));
  }

  function removeModel(index: number) {
    setSettings((current) => ({
      ...current,
      models: current.models.length > 1 ? current.models.filter((_, modelIndex) => modelIndex !== index) : current.models,
    }));
  }

  if (!configured) {
    return (
      <main className="admin-shell">
        <section className="admin-panel compact">
          <h1>Admin Not Configured</h1>
          <p>Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Vercel, then redeploy.</p>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="admin-shell">
        <form className="admin-panel compact" onSubmit={login}>
          <h1>Aivro Admin</h1>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <button className="primary-button compact" type="submit">
            Sign in
          </button>
          {message ? <p className="notice error">{message}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <div className="admin-header">
          <div>
            <p className="eyebrow">Runtime Settings</p>
            <h1>Aivro Admin</h1>
          </div>
          <div className="admin-actions">
            <button className="secondary-button" type="button" onClick={loadSettings} disabled={loading}>
              Reload
            </button>
            <button className="secondary-button" type="button" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        <div className="admin-section">
          <h2>Models</h2>
          {settings.models.map((model, index) => (
            <div className="admin-model-row" key={`${model.id}-${index}`}>
              <label>
                Model
                <input value={model.name} onChange={(event) => updateModel(index, 'name', event.target.value)} placeholder="gpt-image-1" />
              </label>
              <label>
                API Base URL
                <input value={model.api} onChange={(event) => updateModel(index, 'api', event.target.value)} placeholder="https://api.openai.com" />
              </label>
              <label>
                API Key
                <input value={model.key} onChange={(event) => updateModel(index, 'key', event.target.value)} type="password" autoComplete="off" />
              </label>
              <button className="secondary-button" type="button" onClick={() => removeModel(index)}>
                Remove
              </button>
            </div>
          ))}
          <button className="secondary-button" type="button" onClick={addModel}>
            Add Model
          </button>
        </div>

        <div className="admin-grid">
          <section className="admin-section">
            <h2>Queue</h2>
            <label>
              Concurrency
              <input
                type="number"
                min={1}
                value={settings.queue.concurrency}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, queue: { ...current.queue, concurrency: numberValue(event.target.value) } }))
                }
              />
            </label>
            <label>
              Max Waiting
              <input
                type="number"
                min={0}
                value={settings.queue.maxWaiting}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, queue: { ...current.queue, maxWaiting: numberValue(event.target.value) } }))
                }
              />
            </label>
            <label>
              Poll Interval ms
              <input
                type="number"
                min={500}
                value={settings.queue.pollIntervalMs}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, queue: { ...current.queue, pollIntervalMs: numberValue(event.target.value) } }))
                }
              />
            </label>
            <label>
              Running Timeout seconds
              <input
                type="number"
                min={30}
                value={settings.queue.runningJobTimeoutSeconds}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    queue: { ...current.queue, runningJobTimeoutSeconds: numberValue(event.target.value) },
                  }))
                }
              />
            </label>
            <label>
              Result TTL minutes
              <input
                type="number"
                min={1}
                value={settings.queue.jobResultTtlMinutes}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, queue: { ...current.queue, jobResultTtlMinutes: numberValue(event.target.value) } }))
                }
              />
            </label>
          </section>

          <section className="admin-section">
            <h2>Priority</h2>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={settings.queue.priorityQueueEnabled}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, queue: { ...current.queue, priorityQueueEnabled: event.target.checked } }))
                }
              />
              Enable priority queue
            </label>
            <label>
              Daily Limit
              <input
                type="number"
                min={0}
                value={settings.queue.priorityDailyLimit}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, queue: { ...current.queue, priorityDailyLimit: numberValue(event.target.value) } }))
                }
              />
            </label>
          </section>

          <section className="admin-section">
            <h2>Captcha</h2>
            <label>
              Provider
              <select
                value={settings.captcha.provider}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    captcha: { ...current.captcha, provider: event.target.value as AdminSettings['captcha']['provider'] },
                  }))
                }
              >
                <option value="none">none</option>
                <option value="turnstile">turnstile</option>
                <option value="hcaptcha">hcaptcha</option>
              </select>
            </label>
            <label>
              Turnstile Site Key
              <input
                value={settings.captcha.turnstileSiteKey}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, captcha: { ...current.captcha, turnstileSiteKey: event.target.value } }))
                }
              />
            </label>
            <label>
              Turnstile Secret Key
              <input
                type="password"
                value={settings.captcha.turnstileSecretKey}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, captcha: { ...current.captcha, turnstileSecretKey: event.target.value } }))
                }
              />
            </label>
            <label>
              hCaptcha Site Key
              <input
                value={settings.captcha.hcaptchaSiteKey}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, captcha: { ...current.captcha, hcaptchaSiteKey: event.target.value } }))
                }
              />
            </label>
            <label>
              hCaptcha Secret Key
              <input
                type="password"
                value={settings.captcha.hcaptchaSecretKey}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, captcha: { ...current.captcha, hcaptchaSecretKey: event.target.value } }))
                }
              />
            </label>
          </section>

          <section className="admin-section">
            <h2>Security</h2>
            <label>
              IP Hash Salt
              <input
                value={settings.ipHashSalt}
                onChange={(event) => setSettings((current) => ({ ...current, ipHashSalt: event.target.value }))}
              />
            </label>
          </section>
        </div>

        {Object.keys(errors).length ? (
          <div className="notice error">
            {Object.entries(errors).map(([field, error]) => (
              <p key={field}>
                {field}: {error}
              </p>
            ))}
          </div>
        ) : null}
        {message ? <p className={message.startsWith('Saved') ? 'notice success' : 'notice error'}>{message}</p> : null}

        <div className="admin-savebar">
          <button className="primary-button compact" type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </section>
    </main>
  );
}
