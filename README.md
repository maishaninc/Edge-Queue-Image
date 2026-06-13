# Aivro Free Edge Queue Image

Next.js image generation site with a Vercel-compatible queue, OpenAI-compatible image model providers, Turnstile/hCaptcha support, and Turso/libSQL persistence.

The public page is `/zh-CN`. Users submit a prompt, optionally use a daily priority queue, and poll the queue until the image is generated.

## Features

- Next.js App Router UI for `Aivro Free Edge Queue Image`.
- Multiple OpenAI-compatible image model providers from environment variables.
- Serverless-safe queue stored in Turso/libSQL.
- Configurable active generation concurrency and maximum waiting queue size.
- Optional daily priority queue counted per IP hash and UTC date.
- Captcha provider switch: `none`, `turnstile`, or `hcaptcha`.
- Chinese UI with an i18n structure ready for more locales.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000/zh-CN
```

For local UI testing without captcha, set:

```env
CAPTCHA_PROVIDER=none
```

You still need `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to create and poll generation jobs, because queue state is stored in libSQL/Turso.

## Environment Variables

### Model Providers

The app reads one default model group and optional numbered model groups.

| Variable | Required | Example | Description |
| --- | --- | --- | --- |
| `MODEL` | Yes | `gpt-image-1` | Default model name sent as `model` to the OpenAI-compatible image endpoint. |
| `KEY` | Yes | `sk-...` | Default provider API key. Server-side only. Never exposed to the browser. |
| `API` | Yes | `https://api.openai.com` | Default provider base URL. The app calls `${API}/v1/images/generations`. |
| `MODEL_1` | No | `provider-image-model` | Additional provider model name. |
| `KEY_1` | No | `sk-...` | Additional provider API key. |
| `API_1` | No | `https://example.com` | Additional provider base URL. |
| `MODEL_2` / `KEY_2` / `API_2` | No | | Continue numbering for more providers. |

Rules:

- A model group is enabled only when `MODEL`, `KEY`, and `API` are all present for that group.
- Incomplete numbered groups are skipped.
- `API` may include a trailing slash; the app normalizes it.
- The browser only receives safe model IDs and names, never API keys.

Minimal OpenAI example:

```env
MODEL=gpt-image-1
KEY=sk-your-openai-key
API=https://api.openai.com
```

Multiple-provider example:

```env
MODEL=gpt-image-1
KEY=sk-openai-key
API=https://api.openai.com

MODEL_1=provider-image-model
KEY_1=provider-key
API_1=https://provider.example.com
```

### Queue Settings

| Variable | Default | Example | Description |
| --- | --- | --- | --- |
| `QUEUE_CONCURRENCY` | `50` | `50` | Maximum number of jobs allowed to be `running` at the same time. |
| `QUEUE_MAX_WAITING` | `200` | `200` | Maximum number of `queued` jobs. If this limit is reached, new submissions return `queue_full`. |
| `QUEUE_POLL_INTERVAL_MS` | `3000` | `3000` | Browser polling interval for job status. Minimum accepted value is `500`. |
| `RUNNING_JOB_TIMEOUT_SECONDS` | `300` | `300` | Running jobs older than this are marked expired before new jobs are claimed. Minimum accepted value is `30`. |

Queue behavior:

- New jobs start as `queued`.
- Polling `/api/jobs/[id]` advances the queue by claiming available work.
- A job becomes `running` only when current running jobs are below `QUEUE_CONCURRENCY`.
- If `QUEUE_MAX_WAITING=200`, the 201st waiting submission is rejected until the queue drains.

### Priority Queue

| Variable | Default | Example | Description |
| --- | --- | --- | --- |
| `PRIORITY_QUEUE_ENABLED` | `true` | `true` | Enables the UI toggle and server-side priority handling. |
| `PRIORITY_DAILY_LIMIT` | `1` | `3` | Number of priority submissions allowed per IP hash per UTC day. Set `0` to effectively disable usage. |
| `IP_HASH_SALT` | `aivro-edge-queue-image` | `long-random-secret` | Salt used when hashing client IP addresses. Change this in production. |

Priority behavior:

- Priority usage is stored in `priority_usage` by `ip_hash` and UTC date.
- Raw IP addresses are not stored.
- Priority jobs do not enter the protected running window.
- With `QUEUE_CONCURRENCY=50`, priority jobs can start at queue position 51, then 52, and so on.
- Priority jobs are ordered before normal waiting jobs after the protected window.

Recommended production value:

```env
IP_HASH_SALT=use-a-long-random-secret-value
```

### Captcha

| Variable | Required | Example | Description |
| --- | --- | --- | --- |
| `CAPTCHA_PROVIDER` | No | `turnstile` | One of `none`, `turnstile`, or `hcaptcha`. Defaults to `none`. |
| `TURNSTILE_SITE_KEY` | If Turnstile | `0x4AAAA...` | Public Cloudflare Turnstile site key returned to the browser. |
| `TURNSTILE_SECRET_KEY` | If Turnstile | `0x4AAAA...` | Secret used by the server to verify Turnstile tokens. |
| `HCAPTCHA_SITE_KEY` | If hCaptcha | `10000000-...` | Public hCaptcha site key returned to the browser. |
| `HCAPTCHA_SECRET_KEY` | If hCaptcha | `0x...` | Secret used by the server to verify hCaptcha tokens. |

Turnstile example:

```env
CAPTCHA_PROVIDER=turnstile
TURNSTILE_SITE_KEY=your-site-key
TURNSTILE_SECRET_KEY=your-secret-key
```

hCaptcha example:

```env
CAPTCHA_PROVIDER=hcaptcha
HCAPTCHA_SITE_KEY=your-site-key
HCAPTCHA_SECRET_KEY=your-secret-key
```

Local development only:

```env
CAPTCHA_PROVIDER=none
```

Do not use `none` for public production deployments.

### Turso/libSQL Database

| Variable | Required | Example | Description |
| --- | --- | --- | --- |
| `TURSO_DATABASE_URL` | Yes | `libsql://your-db.turso.io` | libSQL/Turso database URL. |
| `TURSO_AUTH_TOKEN` | Yes | `eyJ...` | Auth token for the database. |

The app creates these tables lazily through idempotent SQL:

- `jobs`
- `priority_usage`

The schema lives in `src/lib/db.ts`.

Production notes:

- Vercel functions cannot rely on local SQLite files for durable queue state.
- Use Turso/libSQL for production queue state.
- Do not store `TURSO_AUTH_TOKEN` in client-exposed variables.

## Vercel Deployment

1. Create a Turso database and auth token.
2. Create a Vercel project from this repository.
3. Add all required environment variables in Vercel Project Settings.
4. Use `CAPTCHA_PROVIDER=turnstile` or `CAPTCHA_PROVIDER=hcaptcha` for public deployments.
5. Deploy.

Minimum production variables:

```env
MODEL=gpt-image-1
KEY=sk-your-provider-key
API=https://api.openai.com

TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-token

CAPTCHA_PROVIDER=turnstile
TURNSTILE_SITE_KEY=your-site-key
TURNSTILE_SECRET_KEY=your-secret-key

QUEUE_CONCURRENCY=50
QUEUE_MAX_WAITING=200
QUEUE_POLL_INTERVAL_MS=3000
RUNNING_JOB_TIMEOUT_SECONDS=300
PRIORITY_QUEUE_ENABLED=true
PRIORITY_DAILY_LIMIT=1
IP_HASH_SALT=use-a-long-random-secret-value
```

## API Overview

- `GET /api/config` returns public runtime config, captcha site key, polling interval, and priority remaining count.
- `GET /api/models` returns public model IDs and names.
- `POST /api/jobs` validates captcha, creates a queued job, and returns the job ID.
- `GET /api/jobs/[id]` advances the queue, returns job status, queue position, running count, waiting count, and result data.

## Verification

```bash
npm test
npm run build
```

The test suite covers model parsing and queue ordering rules.
