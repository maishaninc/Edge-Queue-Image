'use client';

import { FormEvent, useState } from 'react';

type AdminModel = {
  id: string;
  name: string;
  api: string;
  key: string;
  dailyLimit: number;
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
  zhCnImageProxyEnabled: boolean;
  csrfToken?: string;
};

type AdminConsoleProps = {
  configured: boolean;
  initialAuthenticated: boolean;
  initialSettings: AdminSettings | null;
};

const emptySettings: AdminSettings = {
  models: [{ id: 'default', name: '', api: '', key: '', dailyLimit: 0 }],
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
  zhCnImageProxyEnabled: false,
};

function numberValue(value: string) {
  return Number.parseInt(value, 10) || 0;
}

const messageText: Record<string, string> = {
  admin_disabled: '管理员后台未启用。',
  admin_not_configured: '管理员后台未配置完整。请在 Vercel 添加 ADMIN_PASSWORD 和 ADMIN_SESSION_SECRET 后重新部署。',
  csrf_invalid: '登录校验已失效，请刷新页面后重试。',
  invalid_password: '密码错误。',
  invalid_settings: '配置校验失败，请检查下面的字段。',
  load_failed: '加载配置失败，请稍后重试。',
  login_failed: '登录失败，请稍后重试。',
  save_failed: '保存失败，请稍后重试。',
  settings_saved: '已保存。新的请求会使用这些配置。',
  too_many_attempts: '登录失败次数过多，请稍后再试。',
  unauthorized: '登录已过期，请重新登录。',
};

const fieldText: Record<string, string> = {
  models: '模型配置',
  'captcha.provider': '验证码服务商',
  'captcha.turnstileSiteKey': 'Turnstile 站点密钥',
  'captcha.turnstileSecretKey': 'Turnstile 私钥',
  'captcha.hcaptchaSiteKey': 'hCaptcha 站点密钥',
  'captcha.hcaptchaSecretKey': 'hCaptcha 私钥',
};

const validationText: Record<string, string> = {
  'At least one model is required.': '至少需要配置一个模型。',
  'API key is required.': 'API 密钥不能为空。',
  'API URL is invalid.': 'API 地址格式不正确。',
  'API URL is required.': 'API 地址不能为空。',
  'API URL must use HTTPS.': 'API 地址必须使用 HTTPS。',
  'Captcha provider is invalid.': '验证码服务商无效。',
  'Model name is required.': '模型名称不能为空。',
  'Turnstile secret key is required.': 'Turnstile 私钥不能为空。',
  'Turnstile site key is required.': 'Turnstile 站点密钥不能为空。',
  'hCaptcha secret key is required.': 'hCaptcha 私钥不能为空。',
  'hCaptcha site key is required.': 'hCaptcha 站点密钥不能为空。',
};

function displayMessage(message: string) {
  return messageText[message] || validationText[message] || message;
}

function displayField(field: string) {
  const modelMatch = field.match(/^models\.(\d+)\.(name|api|key)$/);
  if (modelMatch) {
    const index = Number.parseInt(modelMatch[1], 10) + 1;
    const label = modelMatch[2] === 'name' ? '模型名称' : modelMatch[2] === 'api' ? 'API 基础地址' : 'API 密钥';
    return `模型 ${index} ${label}`;
  }
  return fieldText[field] || field;
}

export default function AdminConsole({ configured, initialAuthenticated, initialSettings }: AdminConsoleProps) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState('');
  const [settings, setSettings] = useState<AdminSettings>(
    initialSettings
      ? {
          ...initialSettings,
          models: initialSettings.models.map((m) => ({ ...m, dailyLimit: (m as AdminModel).dailyLimit ?? 0 })),
        }
      : emptySettings,
  );
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
      setMessage('settings_saved');
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
      models: [...current.models, { id: String(current.models.length), name: '', api: '', key: '', dailyLimit: 0 }],
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
          <h1>管理员后台未配置</h1>
          <p>请在 Vercel 添加 ADMIN_PASSWORD 和 ADMIN_SESSION_SECRET，然后重新部署。</p>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="admin-shell">
        <form className="admin-panel compact" onSubmit={login}>
          <h1>Aivro 管理后台</h1>
          <label>
            登录密码
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <button className="primary-button compact" type="submit">
            登录
          </button>
          {message ? <p className="notice error">{displayMessage(message)}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <div className="admin-header">
          <div>
            <p className="eyebrow">运行时配置</p>
            <h1>Aivro 管理后台</h1>
          </div>
          <div className="admin-actions">
            <button className="secondary-button" type="button" onClick={loadSettings} disabled={loading}>
              刷新
            </button>
            <button className="secondary-button" type="button" onClick={logout}>
              退出
            </button>
          </div>
        </div>

        <div className="admin-section">
          <h2>模型配置</h2>
          {settings.models.map((model, index) => (
            <div className="admin-model-row" key={`${model.id}-${index}`}>
              <label>
                模型名称
                <input value={model.name} onChange={(event) => updateModel(index, 'name', event.target.value)} placeholder="gpt-image-1" />
              </label>
              <label>
                API 基础地址
                <input value={model.api} onChange={(event) => updateModel(index, 'api', event.target.value)} placeholder="https://api.openai.com" />
              </label>
              <label>
                API 密钥
                <input value={model.key} onChange={(event) => updateModel(index, 'key', event.target.value)} type="password" autoComplete="off" />
              </label>
              <label>
                每日上限
                <input
                  type="number"
                  min={0}
                  value={model.dailyLimit}
                  placeholder="0=不限"
                  title="0 表示不限次数"
                  onChange={(event) => updateModel(index, 'dailyLimit', event.target.value)}
                />
              </label>
              <button className="secondary-button" type="button" onClick={() => removeModel(index)}>
                删除
              </button>
            </div>
          ))}
          <button className="secondary-button" type="button" onClick={addModel}>
            添加模型
          </button>
        </div>

        <div className="admin-grid">
          <section className="admin-section">
            <h2>队列设置</h2>
            <label>
              并发数
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
              最大等待数
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
              轮询间隔（毫秒）
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
              运行超时（秒）
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
              结果保留（分钟）
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
            <h2>优先队列</h2>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={settings.queue.priorityQueueEnabled}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, queue: { ...current.queue, priorityQueueEnabled: event.target.checked } }))
                }
              />
              启用优先队列
            </label>
            <label>
              每日次数限制
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
            <h2>验证码</h2>
            <label>
              服务商
              <select
                value={settings.captcha.provider}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    captcha: { ...current.captcha, provider: event.target.value as AdminSettings['captcha']['provider'] },
                  }))
                }
              >
                <option value="none">关闭</option>
                <option value="turnstile">Turnstile</option>
                <option value="hcaptcha">hCaptcha</option>
              </select>
            </label>
            <label>
              Turnstile 站点密钥
              <input
                value={settings.captcha.turnstileSiteKey}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, captcha: { ...current.captcha, turnstileSiteKey: event.target.value } }))
                }
              />
            </label>
            <label>
              Turnstile 私钥
              <input
                type="password"
                value={settings.captcha.turnstileSecretKey}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, captcha: { ...current.captcha, turnstileSecretKey: event.target.value } }))
                }
              />
            </label>
            <label>
              hCaptcha 站点密钥
              <input
                value={settings.captcha.hcaptchaSiteKey}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, captcha: { ...current.captcha, hcaptchaSiteKey: event.target.value } }))
                }
              />
            </label>
            <label>
              hCaptcha 私钥
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
            <h2>安全</h2>
            <label>
              IP 哈希盐值
              <input
                value={settings.ipHashSalt}
                onChange={(event) => setSettings((current) => ({ ...current, ipHashSalt: event.target.value }))}
              />
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={settings.zhCnImageProxyEnabled}
                onChange={(event) => setSettings((current) => ({ ...current, zhCnImageProxyEnabled: event.target.checked }))}
              />
              开启 /zh-CN 中国大陆图片加速
            </label>
          </section>
        </div>

        {Object.keys(errors).length ? (
          <div className="notice error">
            {Object.entries(errors).map(([field, error]) => (
              <p key={field}>
                {displayField(field)}：{displayMessage(error)}
              </p>
            ))}
          </div>
        ) : null}
        {message ? <p className={message === 'settings_saved' ? 'notice success' : 'notice error'}>{displayMessage(message)}</p> : null}

        <div className="admin-savebar">
          <button className="primary-button compact" type="button" onClick={save} disabled={saving}>
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </section>
    </main>
  );
}
