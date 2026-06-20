# Admin Runtime Config Design

## Goal

Add a small administrator backend for the Aivro image queue app so production operators can change model provider, queue, priority, and captcha settings without editing Vercel environment variables after each change.

The app is deployed on Vercel Free, so runtime configuration must be stored in the existing external Turso/libSQL database. The server must not write local files.

## Deployment Model

Keep only bootstrap secrets in Vercel environment variables:

```env
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
ADMIN_PATH=/aivroadmin
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
```

`ADMIN_PATH` controls the private admin entry path. If it is empty, the admin backend is disabled. A configured value such as `/aivroadmin` enables the admin page and admin APIs.

`ADMIN_PASSWORD` is the single administrator password. `ADMIN_SESSION_SECRET` signs the admin session cookie. The password is never stored in the database by the first version.

Existing environment variables for models, queue, priority, and captcha remain supported as fallback values. They are no longer required once equivalent database settings are saved through the admin UI.

## Runtime Config Source

Create an `app_settings` table in Turso/libSQL:

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Store settings as string values under stable keys. Use a JSON value for provider models because the number of models is variable:

- `models_json`
- `queue_concurrency`
- `queue_max_waiting`
- `queue_poll_interval_ms`
- `running_job_timeout_seconds`
- `job_result_ttl_minutes`
- `priority_queue_enabled`
- `priority_daily_limit`
- `captcha_provider`
- `turnstile_site_key`
- `turnstile_secret_key`
- `hcaptcha_site_key`
- `hcaptcha_secret_key`
- `ip_hash_salt`

The runtime lookup order is:

1. Database setting, when present and valid.
2. Environment variable fallback.
3. Existing hard-coded default.

Invalid database values are ignored and fall back instead of breaking public generation.

## Admin Routes

The public admin page is mounted at the configured path, for example `/aivroadmin`.

Routes:

- `GET {ADMIN_PATH}` renders either a login form or the settings console.
- `POST /api/admin/login` verifies `ADMIN_PASSWORD` and sets a signed HttpOnly session cookie.
- `POST /api/admin/logout` clears the session cookie.
- `GET /api/admin/settings` returns editable settings to authenticated admins.
- `PUT /api/admin/settings` validates and saves settings to `app_settings`.

Implement the configurable admin page with a catch-all page route that compares the request path with `ADMIN_PATH`. If the path does not match, return Next.js `notFound()`. API route paths stay fixed under `/api/admin/*` and require the signed admin cookie.

## Authentication

Use one administrator password.

Login verification uses constant-time comparison against `ADMIN_PASSWORD`. On success, the server creates a signed session token using `ADMIN_SESSION_SECRET` and stores it in an HttpOnly, SameSite=Lax, Secure cookie in production.

The session token should contain an issued-at timestamp and expire after 7 days. Requests with missing, expired, or invalid signatures are treated as unauthenticated.

If `ADMIN_PATH` is missing, the catch-all admin page returns `notFound()` and admin APIs return `404`. If `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET` is missing while `ADMIN_PATH` is set, the admin page shows a disabled setup message and admin APIs return `503 admin_not_configured`. Public generation must keep working with environment fallback config.

## Admin UI

The first version is a compact operational console, not a marketing page.

Sections:

- Login: password field and submit button.
- Models: repeatable rows with display name/model, base API URL, API key, and remove/add controls. API keys are submitted to the server; the settings API may return existing key values only to authenticated admins.
- Queue: numeric controls for concurrency, max waiting, poll interval, running timeout, result TTL.
- Priority: enabled toggle and daily limit.
- Captcha: provider select plus Turnstile/hCaptcha site and secret keys.
- Security: IP hash salt.
- Actions: save, reset form from server, logout.

Validation errors are shown inline. A successful save displays a short saved state.

## Runtime Consumers

Update these modules to read the new runtime settings:

- `src/lib/config.ts`: queue, captcha, public runtime config, and IP hash salt source.
- `src/lib/models.ts`: model provider list from `models_json` with environment fallback.
- `src/lib/captcha.ts`: captcha secrets and provider from runtime config.
- `src/lib/request.ts`: IP hash salt from runtime config or a synchronous fallback helper if needed.

Because most runtime reads already happen inside server request handlers, database-backed config can be asynchronous. Where current APIs are synchronous, introduce async variants and update server call sites. Keep pure parsing helpers testable without a database.

## Caching

For correctness and simple operation, read settings from Turso during API requests. Admin saves take effect on the next request.

Do not add a settings cache in the first implementation. Read settings from Turso during API requests so admin saves take effect on the next request without cache invalidation logic.

## Error Handling

Public generation should not fail just because saved admin config is incomplete. Invalid or missing database values fall back to environment/default config.

Admin saves are stricter:

- Model rows require model name, API URL, and API key.
- Queue numeric values must respect existing minimums.
- Captcha provider must be `none`, `turnstile`, or `hcaptcha`.
- When captcha provider is Turnstile or hCaptcha, its site key and secret key must be present.

Saving invalid settings returns `400` with field-level errors.

## Security Notes

The admin path is obscurity, not authentication. The password and signed cookie are the real protection.

Do not expose admin settings through public APIs. `GET /api/models` still returns only public model metadata, never API keys.

Keep secrets in Turso once saved. This reduces Vercel env var changes but means Turso access must be treated as sensitive.

## Tests

Add focused tests for:

- Runtime settings validation and environment fallback.
- Model parsing from database JSON and fallback env variables.
- Admin session signing, verification, expiration, and invalid signature rejection.
- Admin settings save validation.
- Public runtime config does not expose secret values.

Existing queue and model tests should continue to pass.
