# Aivro Free Image Home Redesign

Date: 2026-06-19

## Goal

Update the existing queue-based image generator so the first viewport opens as a focused free image generation experience:

- Primary heading: `Aivro 免费生成图片`.
- Prompt input becomes a long command-style input bar.
- Quality and aspect ratio move into dropdown menus on the right side of the input bar.
- After submission, the input bar closes from both sides toward the center, then a large centered progress panel appears.
- Queued jobs show the user's rank.
- Running jobs show an anime.js generation animation inspired by the existing `MX-Insight-Web` animation direction.
- The top navigation includes links to Aivro product surfaces: workflow, image studio, video studio, model studio, prompt library, assets, free image generation, and prompt reverse.
- The `gpt-image-2` OpenAI-compatible provider configuration is written to `.env.local` for local testing.

## Existing Context

The app is a Next.js project with:

- `src/components/ImageGenerator.tsx` as the main client-side generator.
- `src/components/GenerationLoader.tsx` already present with anime.js SVG drawing animation.
- Queue APIs under `src/app/api/jobs`.
- Provider request logic in `src/lib/image-provider.ts`.
- Model parsing from `MODEL`, `KEY`, and `API` in `src/lib/models.ts`.
- Product navigation link data already defined in `src/lib/i18n.ts` as `NAV_LINKS`.

The current page still uses a two-panel form/status layout, segmented option buttons, and no rendered product navigation links.

## Approach

Use the existing architecture and reshape the first viewport in place. Avoid replacing the queue, database, captcha, history, or provider abstractions unless testing exposes a concrete compatibility bug.

This keeps the implementation scoped to:

- `ImageGenerator.tsx` for the generation command bar and progress states.
- `globals.css` for responsive layout and animations.
- `[locale]/page.tsx` for rendering product navigation.
- `i18n.ts` only if additional copy keys are needed.
- `.env.local` for local provider configuration.
- Provider/options code only if `gpt-image-2` testing shows an incompatibility.

## UI Design

The first viewport uses a focused layout:

1. Sticky header with brand, product links, language switcher, and theme toggle.
2. Centered hero block with `Aivro 免费生成图片`.
3. A command bar below the heading:
   - One long prompt input.
   - Quality dropdown.
   - Aspect ratio dropdown.
   - Submit button.
4. Model selection remains available but should be visually secondary. If there is only one model, it should not dominate the first viewport.
5. Local history and informational sections remain below the first viewport.

On mobile, the prompt input spans full width and the dropdowns/buttons wrap underneath in a stable layout. Text must not overlap controls.

## Submit Animation

On successful job submission:

1. Clear visible errors.
2. Apply a `closing` class to the command bar.
3. Animate the left and right halves inward using CSS pseudo-elements or child panels.
4. After the short close transition, show the progress panel.

The animation is decorative only. If the user prefers reduced motion, skip the close animation and show the progress panel immediately.

## Progress Panel

The large centered panel has one status surface for all job states:

- Before the first poll: `正在准备你的请求`.
- Queued: `正在排队中` and `当前排名：第 {rank} 位`.
- Running: `正在为你生成图片` plus the anime.js loader.
- Succeeded: generated image, retention countdown, download/copy actions, and regenerate.
- Failed or expired: clear error message and regenerate action.

Queue metrics are still shown, but visually secondary to the primary status message.

## Navigation

Render `NAV_LINKS[locale]` in the header:

- 工作流
- 生图工作台
- 视频创作台
- 模型工作台
- 提示词库
- 我的素材
- 免费生成图片
- 提示词反推

Desktop can use a compact horizontal nav. Mobile can use horizontal scrolling or a compact menu, whichever fits the existing implementation with less risk.

## Provider Configuration

Write the local provider values to `.env.local` using existing variable names:

- `MODEL=gpt-image-2`
- `API=https://jiuuij.de5.net`
- `KEY=<provided local key>`

Do not print the key in command output or final messages.

## Error Handling

Keep existing mapped user-facing errors:

- invalid prompt
- invalid model
- invalid options
- queue full
- captcha errors
- provider failure
- database unavailable

If the provider rejects the request because of size, response shape, or unsupported parameters, adjust only the provider/options adapter needed for `gpt-image-2`.

## Testing And Verification

Run:

- `npm test`
- `npm run lint`
- `npm run build`

Then start the app locally and verify:

- `/zh-CN` renders the new first viewport.
- Header product links appear and remain usable.
- Prompt command bar layout works on desktop and mobile widths.
- Submitting a prompt creates a job.
- Queued jobs show rank.
- Running jobs show the anime.js loader.
- Succeeded jobs show the image and actions.

If local database credentials are missing, API-level generation may be blocked by the existing queue database dependency. In that case, document the blocker and still verify build, lint, and UI rendering.
