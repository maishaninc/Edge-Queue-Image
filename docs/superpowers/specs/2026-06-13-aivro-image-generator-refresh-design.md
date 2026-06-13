# Aivro 图片生成器改版设计

日期：2026-06-13

## 目标

将当前图片生成站点改版为品牌更简洁、参数更完整、验证码体验更清晰的 **Aivro** 图片生成器。图片结果在 Turso/libSQL 中临时保存，保留时间由环境变量控制；用户浏览器本地保存不自动过期的历史任务和图片，用户可以手动删除。

本次改版同时解决当前“完成人机验证后仍提示失败”的可观测性不足问题，让前端和服务端能够区分 token 缺失、密钥缺失、验证端点不可达和验证失败。

## 范围

包含：

- 页面品牌显示从 `Aivro Free Edge Queue Image` 改为 `Aivro`。
- 复用参考主题 `D:\Github\MX-Insight-Web\public\logo.svg` 的 A 形标志。
- 首页首屏仍然是可用生成器，并增加向下滚动的功能说明、对比区和 Q&A。
- 提示词输入改为更横向、更适合快速输入的长条区域。
- 增加质量快捷选择：`1K`、`2K`、`4K`。
- 增加比例快捷选择，例如 `1:1`、`16:9`、`9:16`、`4:3`、`3:4`。
- 模型选择项根据模型名称显示对应图标或徽标。
- 人机验证改为弹窗流程。
- 数据库图片结果 TTL 由 `JOB_RESULT_TTL_MINUTES` 控制，默认 15 分钟。
- 浏览器本地历史使用 IndexedDB 保存任务和图片，不自动过期。
- README 和 `.env.example` 同步说明新增环境变量和历史记录行为。

不包含：

- 登录、云端用户历史、后台管理、计费。
- 对象存储上传。
- 多语言扩展；本轮继续以 `/zh-CN` 为主。

## 品牌与视觉

站点公开品牌名为 **Aivro**。页面导航、首屏标题、页脚和元数据都使用 `Aivro`，避免在网站页面继续显示完整工程名 `Aivro Free Edge Queue Image`。

logo 使用参考主题的 `logo.svg`，放入当前项目 `public/logo.svg`。导航中显示 logo 图形和 `Aivro` 文本。移动端仍保留 logo 和品牌名，避免只剩无法识别的缩写。

视觉方向延续参考主题：中性色、细边框、克制阴影、清晰分区、浅色和深色主题。首屏不是营销落地页，而是实际生成工具；向下滚动才展示对比和 Q&A。

## 图片结果保存

数据库继续保存生成结果，但只临时保存。

新增环境变量：

```env
JOB_RESULT_TTL_MINUTES=15
```

规则：

- 默认值为 15。
- 最小有效值为 1。
- 生成成功后写入 `result_url` 或 `result_b64`，并写入 `expires_at = finished_at + JOB_RESULT_TTL_MINUTES`。
- 失败和超时任务也写入 `expires_at`，用于清理旧任务。
- 每次提交任务、轮询任务或推进队列时执行轻量过期清理，删除 `expires_at < now` 的任务。
- 前端显示数据库保留倒计时。
- 如果用户访问已被数据库清理的任务，API 返回 `job_not_found`，前端显示“任务或图片已过期，请重新生成”。

当前 schema 已有 `result_url` 和 `result_b64`，本轮新增 `expires_at` 字段和索引：

- `expires_at TEXT`
- `idx_jobs_expires_at(expires_at)`

## 浏览器本地历史

浏览器本地历史独立于数据库 TTL，不自动过期。用户可以删除单条历史，也可以清空全部历史。

使用 IndexedDB，而不是 localStorage。原因是图片 base64 或 4K 图片可能超过 localStorage 容量，并且 localStorage 同步写入会阻塞页面。

历史记录保存：

- `id`：本地历史 ID。
- `jobId`：服务端任务 ID。
- `prompt`：提示词。
- `modelId` 和 `modelName`。
- `quality`：`1K`、`2K` 或 `4K`。
- `aspectRatio`：比例。
- `createdAt`：生成完成时间。
- `isPriority`：是否使用优先队列。
- `imageBlob`：图片 Blob。
- `mimeType`：图片 MIME 类型。
- `sourceType`：`url` 或 `b64`。

生成成功后：

- 如果 API 返回 base64，前端将 base64 转成 Blob 存入 IndexedDB。
- 如果 API 返回 URL，前端优先用 `fetch` 下载成 Blob 后存入 IndexedDB。
- 如果远程 URL 因 CORS 无法读取，前端仍可先显示远程 URL，并提示“此图片可能无法保存到本地历史”。本轮不新增服务端图片代理，避免将任意远程 URL 代理打开成新攻击面。

历史记录界面：

- 显示图片缩略图、模型、质量、比例、生成时间。
- 操作包括预览、下载、复制提示词、再次生成、删除。
- “再次生成”会把提示词、模型、质量和比例回填到生成表单。
- 清空历史需要二次确认。

## 生成参数

前端新增 `quality` 和 `aspectRatio` 状态，并随 `POST /api/jobs` 提交。

API body 增加：

```ts
{
  quality: '1K' | '2K' | '4K';
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
}
```

服务端将质量和比例转换为 OpenAI-compatible `size` 字符串。

初始映射：

| 质量 | 1:1 | 16:9 | 9:16 | 4:3 | 3:4 |
| --- | --- | --- | --- | --- | --- |
| `1K` | `1024x1024` | `1024x576` | `576x1024` | `1024x768` | `768x1024` |
| `2K` | `2048x2048` | `2048x1152` | `1152x2048` | `2048x1536` | `1536x2048` |
| `4K` | `4096x4096` | `4096x2304` | `2304x4096` | `4096x3072` | `3072x4096` |

注意：不同 OpenAI-compatible provider 对尺寸支持不一致。服务端如果收到 provider 失败，只向前端返回安全错误信息；前端提示用户换用较低质量或不同模型。

数据库 `jobs` 表新增：

- `quality TEXT NOT NULL DEFAULT '1K'`
- `aspect_ratio TEXT NOT NULL DEFAULT '1:1'`

## 模型图标

模型配置仍来自环境变量。公开模型响应增加 `icon` 字段，前端也可根据名称二次推断。

图标匹配规则：

- 名称包含 `openai`、`gpt`：OpenAI 风格徽标。
- 名称包含 `flux`：Flux 徽标。
- 名称包含 `seedream` 或 `doubao`：Seedream/豆包徽标。
- 名称包含 `gemini` 或 `imagen`：Google 风格徽标。
- 名称包含 `stable`、`sd`：Stable Diffusion 徽标。
- 未匹配：通用模型图标。

实现上优先使用 CSS/文字徽标，避免新增重型图标库。

## 人机验证弹窗

当前问题是验证码错误被统一压成 `captcha_failed`，无法判断真实原因。本轮改为更清晰的弹窗和诊断流程。

前端流程：

1. 用户填写提示词并点击生成。
2. 如果 `CAPTCHA_PROVIDER=none`，直接提交。
3. 如果需要验证码，打开弹窗。
4. 用户完成验证后，弹窗内的“确认生成”按钮可用。
5. 提交时使用当前 token。
6. 无论成功或失败，都 reset 验证码 token，避免复用过期 token。

组件行为：

- Turnstile 和 hCaptcha 都处理成功、过期、错误事件。
- token 过期后禁用确认按钮。
- 弹窗关闭时 reset token。

服务端返回安全错误码：

- `captcha_missing`
- `captcha_secret_missing`
- `captcha_unreachable`
- `captcha_invalid`

前端中文提示：

- 未完成验证：`请先完成人机验证。`
- 服务端密钥缺失：`验证码服务配置不完整，请联系站点管理员。`
- 验证服务不可达：`验证码服务暂时不可用，请稍后重试。`
- 验证未通过：`人机验证未通过，请重新验证。`

## 首页结构

首屏：

- 导航：logo、`Aivro`、语言、主题切换。
- 主生成器：长条提示词输入、模型选择、质量快捷按钮、比例快捷按钮、优先队列开关、生成按钮。
- 状态/结果区：排队位置、运行中数量、等待数量、数据库保留倒计时、图片预览、下载、复制地址或复制提示词、重新生成。
- 历史记录入口：显示最近若干条本地历史，可展开查看全部。

向下滚动：

- 功能区：免费队列、多模型、优先队列、本地历史、临时数据库保存、验证码保护。
- 对比区：Aivro 与普通临时图片生成页对比，突出队列透明、本地历史、15 分钟数据库 TTL、中文体验。
- Q&A：解释 Turso/libSQL、图片保存时间、本地历史、验证码失败、模型尺寸兼容性。

## API 变更

`GET /api/config` 返回：

- `jobResultTtlMinutes`

`GET /api/models` 返回：

- `id`
- `name`
- `icon`

`POST /api/jobs` 接收：

- `prompt`
- `modelId`
- `captchaToken`
- `usePriority`
- `quality`
- `aspectRatio`

`GET /api/jobs/[id]` 返回：

- `quality`
- `aspectRatio`
- `expiresAt`
- `resultUrl`
- `resultB64`

## 错误处理

新增或细化错误码：

- `captcha_missing`
- `captcha_secret_missing`
- `captcha_unreachable`
- `captcha_invalid`
- `job_expired`
- `invalid_image_options`

API 不暴露 provider API key、完整上游响应体或原始异常堆栈。

## 测试

需要覆盖：

- `JOB_RESULT_TTL_MINUTES` 解析默认值、合法值和过小值。
- 图片尺寸映射：质量和比例组合。
- 任务成功后写入 `expires_at`。
- 过期任务清理。
- 验证码错误码映射。
- 模型图标推断。
- 构建验证：`npm run build`。

浏览器 IndexedDB 历史以组件和工具函数为主，至少覆盖 base64 转 Blob、历史记录增删查和表单回填逻辑。

## 实施顺序

1. 扩展配置、模型和图片参数工具函数。
2. 扩展数据库 schema、任务创建、任务运行和过期清理。
3. 改造验证码服务端错误码和前端弹窗。
4. 新增 IndexedDB 历史工具和历史 UI。
5. 改造首页品牌、logo、生成器布局、对比区和 Q&A。
6. 更新 README 和 `.env.example`。
7. 运行测试和构建。
