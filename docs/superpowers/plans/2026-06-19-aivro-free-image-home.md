# Aivro Free Image Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the first viewport into a focused Aivro free image generator, wire provider configuration for `gpt-image-2`, and verify queue generation behavior.

**Architecture:** Keep the existing Next.js app, queue APIs, provider abstraction, local history, captcha flow, and i18n copy. Reshape the client UI in `ImageGenerator.tsx`, render existing nav link data in `[locale]/page.tsx`, and add focused CSS classes in `globals.css`. Only change provider/options logic if live testing proves `gpt-image-2` requires a compatibility fix.

**Tech Stack:** Next.js 16, React 19, TypeScript, anime.js 4, Node test runner, ESLint.

---

## File Structure

- Modify `src/app/[locale]/page.tsx`: render `NAV_LINKS[locale]` in the header.
- Modify `src/components/ImageGenerator.tsx`: replace the first viewport form/status layout with a command bar and central progress panel while preserving existing queue/history behavior.
- Modify `src/components/GenerationLoader.tsx`: keep or tune the anime.js SVG loader if build/runtime errors appear.
- Modify `src/app/globals.css`: add responsive nav, command bar, closing animation, progress panel, and mobile rules.
- Modify `src/lib/i18n.ts`: add only missing copy needed by the redesigned UI.
- Modify `.env.local`: set `MODEL`, `API`, and `KEY` locally. Do not commit this file.
- Optional modify `src/lib/image-provider.ts` or `src/lib/image-options.ts`: only if provider testing shows a concrete request-format incompatibility.

## Task 1: Navigation Links

**Files:**
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Render existing nav link data**

In `src/app/[locale]/page.tsx`, add `NAV_LINKS` to the i18n import and render links between the brand and `.nav-actions`:

```tsx
import {
  LOCALES,
  NAV_LINKS,
  OG_LOCALE_BY_LOCALE,
  COPY,
  SEO_COPY,
  SITE_NAME,
  absoluteLocaleUrl,
  isSiteLocale,
  relativeLanguageAlternates,
  relativeLocalePath,
  type SiteLocale,
} from '@/lib/i18n';
```

```tsx
<nav className="product-nav" aria-label={copy.navMenu}>
  {NAV_LINKS[siteLocale].map((link) => (
    <a key={link.href} className={link.active ? 'active' : ''} href={link.href}>
      {link.label}
    </a>
  ))}
</nav>
```

- [ ] **Step 2: Style nav without squeezing header controls**

Add CSS:

```css
.product-nav {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}

.product-nav::-webkit-scrollbar {
  display: none;
}

.product-nav a {
  white-space: nowrap;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  color: var(--muted-foreground);
  font-size: 13px;
}

.product-nav a:hover,
.product-nav a.active {
  background: var(--secondary);
  color: var(--foreground);
}

.nav-inner {
  gap: 16px;
}

.nav-actions {
  flex: 0 0 auto;
}
```

- [ ] **Step 3: Verify header compile**

Run: `npm run lint`

Expected: no new lint errors from `[locale]/page.tsx`.

## Task 2: Command Bar First Viewport

**Files:**
- Modify: `src/components/ImageGenerator.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the top hero copy and form shell**

In `ImageGenerator.tsx`, keep the existing state and handlers. Replace the top `hero-workspace` markup so the first viewport starts with:

```tsx
<section className={`hero-workspace${jobId ? ' has-job' : ''}`} id="generator">
  <div className="hero-center">
    <p className="eyebrow">{copy.freeGenerate}</p>
    <h1>{copy.title} {copy.freeGenerate}</h1>
    <p>{copy.heroTagline}</p>
  </div>

  {!jobId ? (
    <form
      className={`prompt-command${closing ? ' closing' : ''}`}
      onSubmit={(event) => {
        event.preventDefault();
        requestSubmit();
      }}
    >
      <input
        className="prompt-command-input"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={copy.promptBarPlaceholder}
        maxLength={4000}
      />
      <select value={quality} onChange={(event) => setQuality(event.target.value as ImageQuality)} aria-label={copy.qualityLabel}>
        {IMAGE_QUALITIES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as ImageAspectRatio)} aria-label={copy.aspectRatioLabel}>
        {IMAGE_ASPECT_RATIOS.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <button className="primary-button prompt-submit" type="submit" disabled={submitting || !prompt.trim() || !models.length}>
        {submitting ? copy.submitting : copy.submit}
      </button>
    </form>
  ) : (
    <section className="generation-stage" aria-live="polite">
      <div className="stage-heading">
        <p className="eyebrow">{copy.queueTitle}</p>
        <h2>{copy.startingTitle}</h2>
      </div>
    </section>
  )}
</section>
```

Use `copy.title` and `copy.freeGenerate` so Chinese displays `Aivro 免费生成图片` without adding locale-specific hardcoded text.

- [ ] **Step 2: Build the command controls**

Inside the form, use a single text input and two select menus:

```tsx
<input
  className="prompt-command-input"
  value={prompt}
  onChange={(event) => setPrompt(event.target.value)}
  placeholder={copy.promptBarPlaceholder}
  maxLength={4000}
/>

<select value={quality} onChange={(event) => setQuality(event.target.value as ImageQuality)} aria-label={copy.qualityLabel}>
  {IMAGE_QUALITIES.map((item) => (
    <option key={item} value={item}>
      {item}
    </option>
  ))}
</select>

<select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as ImageAspectRatio)} aria-label={copy.aspectRatioLabel}>
  {IMAGE_ASPECT_RATIOS.map((item) => (
    <option key={item} value={item}>
      {item}
    </option>
  ))}
</select>

<button className="primary-button prompt-submit" type="submit" disabled={submitting || !prompt.trim() || !models.length}>
  {submitting ? copy.submitting : copy.submit}
</button>
```

- [ ] **Step 3: Keep model and priority controls secondary**

Render existing model chips and priority toggle below the command bar in a compact `.secondary-controls` block. If only one model exists, show a small selected model label rather than a dominant control.

- [ ] **Step 4: Style the command bar**

Add CSS:

```css
.hero-center {
  max-width: 760px;
  margin: 0 auto 28px;
  text-align: center;
}

.hero-center h1 {
  margin: 0;
  font-size: clamp(34px, 6vw, 64px);
  line-height: 1.05;
}

.hero-center p:not(.eyebrow) {
  margin: 16px auto 0;
  max-width: 660px;
  color: var(--muted-foreground);
  line-height: 1.7;
}

.prompt-command {
  position: relative;
  max-width: 980px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 116px 116px 148px;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: 0 18px 60px rgba(28, 25, 23, 0.08);
  overflow: hidden;
}

.prompt-command-input {
  min-height: 48px;
  border: 0;
  outline: none;
  padding: 0 14px;
  background: transparent;
  color: var(--foreground);
}

.prompt-command select {
  height: 48px;
}

.prompt-submit {
  min-height: 48px;
}
```

- [ ] **Step 5: Verify responsive wrapping**

Add mobile CSS:

```css
@media (max-width: 820px) {
  .prompt-command {
    grid-template-columns: 1fr 1fr;
  }

  .prompt-command-input {
    grid-column: 1 / -1;
  }

  .prompt-submit {
    width: 100%;
  }
}
```

Run: `npm run lint`

Expected: no JSX/type lint errors from changed markup.

## Task 3: Submit Close Animation And Progress Panel

**Files:**
- Modify: `src/components/ImageGenerator.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Make `closing` state useful and resettable**

In `submitWithToken`, set `closing` before showing the job, then delay the visible stage transition briefly:

```tsx
setClosing(true);
window.setTimeout(() => {
  setJobId(data.id);
  setJobState(null);
}, 360);
```

When resetting for another generation, also call `setClosing(false)`.

- [ ] **Step 2: Add reduced motion handling through CSS**

Use CSS so the animation is skipped for reduced motion:

```css
.prompt-command::before,
.prompt-command::after {
  content: '';
  position: absolute;
  inset-block: 0;
  width: 50%;
  background: var(--primary);
  transform: scaleX(0);
  transition: transform 0.34s ease;
  z-index: 2;
  pointer-events: none;
}

.prompt-command::before {
  left: 0;
  transform-origin: left;
}

.prompt-command::after {
  right: 0;
  transform-origin: right;
}

.prompt-command.closing::before,
.prompt-command.closing::after {
  transform: scaleX(1);
}

@media (prefers-reduced-motion: reduce) {
  .prompt-command::before,
  .prompt-command::after {
    transition: none;
  }
}
```

- [ ] **Step 3: Render the progress stage**

Create a local derived value:

```tsx
const activeStatus = jobState?.job.status;
const queueRank = jobState?.queue.queuePosition;
```

Render:

```tsx
<section className="generation-stage" aria-live="polite">
  <div className="stage-heading">
    <p className="eyebrow">{copy.queueTitle}</p>
    <h2>
      {!jobState
        ? copy.startingTitle
        : activeStatus === 'queued'
          ? copy.queueWaitingTitle
          : activeStatus === 'running'
            ? copy.generatingTitle
            : copy[STATUS_LABELS[jobState.job.status]]}
    </h2>
    {jobState?.job.status === 'queued' && queueRank ? <p>{copy.queueRankText.replace('{rank}', String(queueRank))}</p> : null}
    {jobState?.job.status === 'running' ? <p>{copy.generatingHint}</p> : null}
  </div>
  {jobState?.job.status === 'running' ? <GenerationLoader /> : null}
  <div className="metrics-grid compact">
    <div>
      <span>{copy.queuePosition}</span>
      <strong>{jobState?.queue.queuePosition ?? '-'}</strong>
    </div>
    <div>
      <span>{copy.runningCount}</span>
      <strong>{jobState?.queue.runningCount ?? 0}</strong>
    </div>
    <div>
      <span>{copy.waitingCount}</span>
      <strong>{jobState?.queue.waitingCount ?? 0}</strong>
    </div>
  </div>
</section>
```

Keep the existing result, TTL, failed/expired, metrics, copy URL, and regenerate controls inside this stage.

- [ ] **Step 4: Style the stage**

Add CSS:

```css
.generation-stage {
  width: min(100%, 760px);
  min-height: 420px;
  margin: 0 auto;
  padding: 28px;
  display: grid;
  align-content: center;
  gap: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 80px rgba(28, 25, 23, 0.1);
  text-align: center;
}

[data-theme="dark"] .generation-stage {
  background: rgba(28, 25, 23, 0.94);
}

.generation-loader {
  width: 128px;
  height: 128px;
  margin: 0 auto;
  color: var(--foreground);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: all existing tests pass because queue API contracts are unchanged.

## Task 4: Local Provider Configuration And Live Test

**Files:**
- Modify: `.env.local`
- Optional modify: `src/lib/image-provider.ts`
- Optional modify: `src/lib/image-options.ts`
- Optional test: `tests/image-provider.test.ts`

- [ ] **Step 1: Write local env values**

Update `.env.local` using existing variable names:

```dotenv
MODEL=gpt-image-2
API=https://jiuuij.de5.net
KEY=<provided key>
```

Do not stage or commit `.env.local`.

- [ ] **Step 2: Run config/model tests**

Run: `npm test`

Expected: model parsing still passes because `MODEL`, `KEY`, and `API` are already supported.

- [ ] **Step 3: Start local app**

Run: `npm run dev`

Expected: Next.js starts and prints a localhost URL.

- [ ] **Step 4: Submit a short test prompt**

Use the browser UI on `/zh-CN` or POST to `/api/jobs`:

```json
{
  "prompt": "a clean product photo of a white ceramic cup on a dark table",
  "modelId": "default",
  "captchaToken": "",
  "usePriority": false,
  "quality": "1K",
  "aspectRatio": "1:1"
}
```

Expected: API returns a job id, polling reaches `running` or `succeeded`, and no provider request-format error appears.

- [ ] **Step 5: If provider rejects size, add a failing adapter test**

Create `tests/image-provider.test.ts` with a mocked `fetch` that asserts the generated payload. Use this shape:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateImage } from '../src/lib/image-provider';

test('sends OpenAI-compatible image generation payload', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'gpt-image-2');
    assert.equal(body.prompt, 'test prompt');
    assert.equal(body.size, '1024x1024');
    assert.equal(body.n, 1);
    return new Response(JSON.stringify({ data: [{ b64_json: 'abc' }] }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await generateImage({
      model: { id: 'default', name: 'gpt-image-2', api: 'https://jiuuij.de5.net', key: 'test-key' },
      prompt: 'test prompt',
      count: 1,
      quality: '1K',
      aspectRatio: '1:1',
    });
    assert.equal(result.b64, 'abc');
  } finally {
    globalThis.fetch = previousFetch;
  }
});
```

Run: `npm test`

Expected: this test passes unless implementation must change for live provider compatibility.

## Task 5: Final Verification

**Files:**
- No source edits unless verification fails.

- [ ] **Step 1: Run full automated checks**

Run:

```powershell
npm test
npm run lint
npm run build
```

Expected: all commands pass.

- [ ] **Step 2: Inspect uncommitted changes**

Run:

```powershell
git status --short
git diff -- src/app/[locale]/page.tsx src/components/ImageGenerator.tsx src/components/GenerationLoader.tsx src/app/globals.css src/lib/i18n.ts src/lib/image-provider.ts src/lib/image-options.ts tests
```

Expected: only intended files changed; `.env.local` remains unstaged.

- [ ] **Step 3: Summarize outcome**

Final response must include:

- UI changes completed.
- Provider configuration written locally without exposing the key.
- Test commands run and their pass/fail status.
- Any live provider/database blocker, if present.
