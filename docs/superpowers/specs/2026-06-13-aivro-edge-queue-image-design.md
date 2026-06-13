# Aivro Free Edge Queue Image Design

Date: 2026-06-13

## Goal

Build a Vercel-compatible Next.js image generation site named **Aivro Free Edge Queue Image**. Users enter a prompt, pass a configurable captcha, choose an OpenAI-compatible image model, and receive generated images through a shared queue. The first production target is Vercel, so persistent queue state must live in external libSQL/Turso instead of memory or local SQLite files.

## Scope

The first version includes:

- Next.js App Router site with `/zh-CN` as the primary locale.
- OpenAI-compatible image generation providers configured through environment variables.
- Serverless-safe queue backed by Turso/libSQL.
- Configurable concurrency, maximum waiting count, polling interval, and priority queue limits.
- Captcha provider switch for Cloudflare Turnstile, hCaptcha, or local disabled mode.
- Chinese UI with an i18n structure ready for more locales.
- Visual style inspired by `D:\Github\MX-Insight-Web`.

The first version does not include login, billing, user galleries, admin dashboards, or account history.

## Deployment Assumptions

The app must work on Vercel Serverless/Fluid Compute. It must not depend on process memory, background workers inside a single Node process, or local writable SQLite files. `/tmp` is not used for durable state.

Turso/libSQL is treated as the SQLite-compatible production database.

## Environment Variables

Model providers use one default group and optional numbered groups:

```env
MODEL=
KEY=
API=

MODEL_1=
KEY_1=
API_1=

MODEL_2=
KEY_2=
API_2=
```

`MODEL`, `KEY`, and `API` define the default provider. Numbered groups are scanned in ascending order and included only when all three values exist. `KEY` stays server-side only. `API` is the OpenAI-compatible base URL, and the server calls `${API}/v1/images/generations`.

Queue and captcha configuration:

```env
QUEUE_CONCURRENCY=50
QUEUE_MAX_WAITING=200
QUEUE_POLL_INTERVAL_MS=3000
RUNNING_JOB_TIMEOUT_SECONDS=300

PRIORITY_QUEUE_ENABLED=true
PRIORITY_DAILY_LIMIT=1

CAPTCHA_PROVIDER=turnstile
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
HCAPTCHA_SITE_KEY=
HCAPTCHA_SECRET_KEY=

TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
```

`CAPTCHA_PROVIDER` supports `none`, `turnstile`, and `hcaptcha`. `none` is intended for local development.

## Architecture

The app uses Next.js App Router.

Routes:

- `/` redirects to `/zh-CN`.
- `/zh-CN` is the main generation page.

API routes:

- `GET /api/config` returns public runtime config such as captcha provider, captcha site key, polling interval, and priority queue setting.
- `GET /api/models` returns safe model descriptors: model ID and display name only.
- `POST /api/jobs` validates captcha, validates model ID, checks queue capacity, consumes optional priority quota, and creates a queued job.
- `GET /api/jobs/[id]` returns current status, queue position, running count, waiting count, and result data when complete. It also attempts to advance the queue when capacity is available.

Server modules:

- `src/lib/config.ts` parses environment variables.
- `src/lib/models.ts` scans model groups and resolves model IDs.
- `src/lib/db.ts` owns the libSQL client and schema helpers.
- `src/lib/queue.ts` owns queue ordering, capacity checks, priority rules, and atomic job claiming.
- `src/lib/captcha.ts` verifies Turnstile or hCaptcha tokens.
- `src/lib/image-provider.ts` calls OpenAI-compatible image generation endpoints.
- `src/lib/i18n.ts` stores localized UI strings.

## Queue Behavior

Jobs use these statuses:

- `queued`
- `running`
- `succeeded`
- `failed`
- `expired`

Submitting a prompt creates a `queued` job unless the queue is full. Queue fullness is based on the number of waiting `queued` jobs. If `queued >= QUEUE_MAX_WAITING`, `POST /api/jobs` returns `queue_full`.

Running capacity is based on `QUEUE_CONCURRENCY`. A job may move from `queued` to `running` only when current active `running` jobs are below this limit.

Normal queue order is FIFO by `created_at ASC`.

Priority queue is available only when `PRIORITY_QUEUE_ENABLED=true`. The client shows a "use priority queue" option and the server enforces daily IP limits. Priority jobs are ordered before normal waiting jobs but cannot bypass the protected running window. With `QUEUE_CONCURRENCY=50`, priority insertion starts at queue position 51. If positions 51, 52, and later are already priority jobs, new priority jobs are placed after those priority jobs and before normal waiting jobs.

The queue is advanced opportunistically by status polling. When `/api/jobs/[id]` runs, the server first releases expired running jobs, then attempts to claim available queued jobs up to the configured concurrency. Claiming uses a database transaction or conditional update so multiple Vercel instances cannot claim the same job.

## Priority Usage

Priority usage is tracked by IP hash and date. `PRIORITY_DAILY_LIMIT=N` allows each IP hash to use priority queue N times per UTC calendar day. The date is stored as a stable UTC date string. Old rows do not need immediate deletion because reads filter by date.

The app stores only an IP hash, not the raw IP address.

## Database Schema

`jobs`:

- `id TEXT PRIMARY KEY`
- `status TEXT NOT NULL`
- `prompt TEXT NOT NULL`
- `model_id TEXT NOT NULL`
- `is_priority INTEGER NOT NULL DEFAULT 0`
- `ip_hash TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `started_at TEXT`
- `finished_at TEXT`
- `result_url TEXT`
- `result_b64 TEXT`
- `error_code TEXT`
- `error_message_safe TEXT`

Indexes:

- `idx_jobs_status_created_at(status, created_at)`
- `idx_jobs_status_priority_created_at(status, is_priority, created_at)`
- `idx_jobs_running_started_at(status, started_at)`

`priority_usage`:

- `ip_hash TEXT NOT NULL`
- `usage_date TEXT NOT NULL`
- `used_count INTEGER NOT NULL DEFAULT 0`
- `PRIMARY KEY (ip_hash, usage_date)`

Schema creation can run lazily at startup/API execution through an idempotent helper for local development. Production deployments should also be able to run the same SQL manually.

## Image Generation

The server resolves the selected model ID to a provider group and calls:

```text
POST {API}/v1/images/generations
Authorization: Bearer {KEY}
```

The request includes `model`, `prompt`, and supported image parameters such as `size` and `n`. The first version should keep parameters conservative and compatible across OpenAI-style providers.

The response parser accepts common OpenAI image response shapes:

- image URL in `data[].url`
- base64 JSON in `data[].b64_json`

The job stores either `result_url` or `result_b64`.

## Captcha

The front end reads captcha configuration from `/api/config`.

When `CAPTCHA_PROVIDER=turnstile`, the UI renders Cloudflare Turnstile and the server verifies with the Turnstile secret.

When `CAPTCHA_PROVIDER=hcaptcha`, the UI renders hCaptcha and the server verifies with the hCaptcha secret.

When `CAPTCHA_PROVIDER=none`, the UI hides captcha and the server skips verification. This should be documented as development-only.

## Frontend UX

The first screen is the usable generator, not a marketing landing page.

Main UI:

- Brand header: `Aivro Free Edge Queue Image`
- Language switcher with `/zh-CN` active
- Theme toggle
- Prompt textarea
- Model selector
- Basic image options
- Captcha widget
- Optional priority queue toggle with remaining daily usage
- Submit button

After submission, the same main area switches to queue status:

- Job status
- Queue position
- Current running count
- Current waiting count
- Priority status
- Polling progress
- Failure message when needed

On success:

- Image preview
- Download action
- Copy image URL action when URL output is available
- Generate another action

The visual direction follows `MX-Insight-Web`: restrained tech styling, light/dark themes, clear panels, thin borders, and responsive single-column mobile layout. The page should remain compact and task-focused.

## Error Handling

Public error codes:

- `captcha_failed`
- `queue_full`
- `model_not_found`
- `priority_limit_reached`
- `invalid_prompt`
- `job_not_found`
- `provider_failed`
- `job_timeout`
- `database_unavailable`

The API must not expose provider API keys, raw provider stack traces, or full upstream error bodies to the browser. Provider failures are stored as safe error codes/messages and shown as a short retry-friendly message.

Running jobs older than `RUNNING_JOB_TIMEOUT_SECONDS` are marked `failed` or `expired` before claiming more queue capacity.

## Testing

Test coverage should include:

- Environment model parsing, including default group and numbered groups.
- Skipping incomplete model groups.
- Queue FIFO ordering for normal jobs.
- Priority queue ordering after the protected concurrency window.
- Priority daily limit per IP hash.
- API behavior for queue full, invalid model, captcha provider switching, and job status polling.
- Build verification with `npm run build`.

## Implementation Notes

The queue design intentionally avoids a separate worker for the first version. Polling requests advance the queue and can execute generation work. If traffic grows or provider calls become too slow for Vercel request limits, the same schema can support moving queue claiming and generation into an external worker later.

The implementation should keep provider, queue, captcha, and config code in separate modules so that this migration does not require rewriting the UI or database model.
