# Aivro 图片生成器

这是一个基于 Next.js 的图片生成站点，内置兼容 Vercel 的队列、兼容 OpenAI 图片接口的模型提供商配置、Turnstile/hCaptcha 支持、管理员后台，以及 Turso/libSQL 持久化。

默认公开页面位于 `/en-US`，根路径 `/` 会跳转到 `/en-US`。用户提交提示词后，可以选择模型、质量、比例和每日优先队列，并轮询队列状态直到图片生成完成。

## 功能

- 使用 Next.js App Router 构建 `Aivro` 界面。
- 通过管理员后台配置多个兼容 OpenAI 图片接口的模型提供商，环境变量作为兜底。
- 使用 Turso/libSQL 存储队列，适配无服务器运行环境。
- 图片结果临时保存到数据库，保留时间由 `JOB_RESULT_TTL_MINUTES` 控制。
- 浏览器使用 IndexedDB 保存本地历史任务和图片，直到用户手动删除。
- 可配置活跃生成并发数和最大等待队列长度。
- 可选每日优先队列，按 IP 哈希和协调世界时日期统计次数。
- 验证码提供商可切换为 `none`、`turnstile` 或 `hcaptcha`，前端使用弹窗验证。
- 管理员后台支持运行时保存模型、队列、验证码和安全配置，不需要每次改 Vercel 环境变量。
- 支持 English、简体中文、繁體中文、日本語四种界面语言。

## 本地启动

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000/en-US
```

支持的语言路径：

- `/en-US`
- `/zh-CN`
- `/zh-TW`
- `/ja`

只浏览页面不需要数据库。创建和轮询生成任务需要 Turso/libSQL 配置，因为队列状态存储在数据库中。

本地最小 `.env.local` 示例：

```env
TURSO_DATABASE_URL=file:local-dev.db
CAPTCHA_PROVIDER=none

ADMIN_PATH=/aivroadmin
ADMIN_PASSWORD=local-admin-password
ADMIN_SESSION_SECRET=local-development-secret
```

使用本地 SQLite 文件时不需要 `TURSO_AUTH_TOKEN`。如果连接远程 Turso，则需要同时设置 `TURSO_DATABASE_URL` 和 `TURSO_AUTH_TOKEN`。

## 配置方式

推荐生产模式是：Vercel 只保存数据库和后台引导密钥，模型、队列、验证码等运行配置在管理员后台保存到 Turso。

运行时读取顺序：

1. Turso `app_settings` 中的后台配置。
2. Vercel 或 `.env.local` 中的环境变量。
3. 应用默认值。

因此，首次部署只需要最小环境变量；进入后台保存配置后，后续修改不需要重新部署。

## 可选环境变量兜底

### 模型提供商

如果还没有通过后台保存模型配置，应用会读取一组默认模型配置，以及可选的编号模型配置。

| 变量 | 必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| `MODEL` | 否 | `gpt-image-1` | 发送到兼容 OpenAI 图片接口的默认模型名称，对应请求中的 `model`。 |
| `KEY` | 否 | `sk-...` | 默认提供商的 API 密钥。仅在服务端使用，绝不暴露给普通前端接口。 |
| `API` | 否 | `https://api.openai.com` | 默认提供商的基础地址。应用会调用 `${API}/v1/images/generations`。 |
| `MODEL_1` | 否 | `provider-image-model` | 额外提供商的模型名称。 |
| `KEY_1` | 否 | `sk-...` | 额外提供商的 API 密钥。 |
| `API_1` | 否 | `https://example.com` | 额外提供商的基础地址。 |
| `MODEL_2` / `KEY_2` / `API_2` | 否 | | 继续编号即可配置更多提供商。 |

规则：

- 只有当某组配置同时存在 `MODEL`、`KEY` 和 `API` 时，该模型组才会启用。
- 编号模型组如果配置不完整，会被跳过。
- `API` 可以包含末尾斜杠，应用会自动规范化。
- 普通浏览器接口只会收到安全的模型 ID 和名称，不会收到 API 密钥。
- 后台保存的 API Base URL 必须是合法 HTTPS 地址。

环境变量兜底配置示例：

```env
MODEL=gpt-image-1
KEY=sk-your-openai-key
API=https://api.openai.com
```

多提供商配置示例：

```env
MODEL=gpt-image-1
KEY=sk-openai-key
API=https://api.openai.com

MODEL_1=provider-image-model
KEY_1=provider-key
API_1=https://provider.example.com
```

### 队列设置

| 变量 | 默认值 | 示例 | 说明 |
| --- | --- | --- | --- |
| `QUEUE_CONCURRENCY` | `50` | `50` | 同一时间允许处于 `running` 状态的最大任务数。 |
| `QUEUE_MAX_WAITING` | `200` | `200` | 允许处于 `queued` 状态的最大任务数。达到限制后，新提交会返回 `queue_full`。 |
| `QUEUE_POLL_INTERVAL_MS` | `3000` | `3000` | 浏览器轮询任务状态的间隔，允许的最小值为 `500`。 |
| `RUNNING_JOB_TIMEOUT_SECONDS` | `300` | `300` | 超过该时长仍处于运行中的任务，会在领取新任务前被标记为过期。允许的最小值为 `30`。 |
| `JOB_RESULT_TTL_MINUTES` | `15` | `15` | 图片结果在数据库中的临时保留时间，允许的最小值为 `1`。浏览器本地历史不受该值影响。 |

队列行为：

- 新任务初始状态为 `queued`。
- 轮询 `/api/jobs/[id]` 会推进队列，并领取可执行的任务。
- 只有当前运行中任务数量低于 `QUEUE_CONCURRENCY` 时，任务才会变为 `running`。
- 如果 `QUEUE_MAX_WAITING=200`，第 201 个等待中的提交会被拒绝，直到队列消化出空位。

### 图片保存和本地历史

- 生成结果会保存到 Turso/libSQL 的 `jobs.result_url` 或 `jobs.result_b64` 字段。
- 每个完成、失败或超时任务都会写入 `expires_at`。
- `JOB_RESULT_TTL_MINUTES` 只控制数据库里的任务和图片结果保留时间。
- 前端会显示数据库保留倒计时。
- 浏览器本地历史使用 IndexedDB 保存历史任务和图片，不自动过期。
- 用户可以删除单条本地历史，也可以清空全部历史。
- 清除浏览器站点数据会删除本地历史。

### 优先队列

| 变量 | 默认值 | 示例 | 说明 |
| --- | --- | --- | --- |
| `PRIORITY_QUEUE_ENABLED` | `true` | `true` | 启用界面开关和服务端优先队列处理。 |
| `PRIORITY_DAILY_LIMIT` | `1` | `3` | 每个 IP 哈希每天允许使用的优先提交次数，日期按协调世界时计算。设置为 `0` 等同于禁用使用次数。 |
| `IP_HASH_SALT` | `aivro-edge-queue-image` | `long-random-secret` | 对客户端 IP 地址进行哈希时使用的盐值。生产环境应修改为自定义值。 |

优先队列行为：

- 优先使用记录按 `ip_hash` 和协调世界时日期存储在 `priority_usage` 中。
- 不存储原始 IP 地址。
- 优先任务不会进入受保护的运行窗口。
- 当 `QUEUE_CONCURRENCY=50` 时，优先任务可以从队列位置 51 开始运行，然后是 52，以此类推。
- 在受保护窗口之后，优先任务会排在普通等待任务之前。

推荐的生产环境取值：

```env
IP_HASH_SALT=use-a-long-random-secret-value
```

### 验证码

| 变量 | 必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| `CAPTCHA_PROVIDER` | 否 | `turnstile` | 可选值为 `none`、`turnstile` 或 `hcaptcha`，默认值为 `none`。 |
| `TURNSTILE_SITE_KEY` | 使用 Turnstile 时必填 | `0x4AAAA...` | 返回给浏览器的 Cloudflare Turnstile 公开站点密钥。 |
| `TURNSTILE_SECRET_KEY` | 使用 Turnstile 时必填 | `0x4AAAA...` | 服务端用于验证 Turnstile 令牌的密钥。 |
| `HCAPTCHA_SITE_KEY` | 使用 hCaptcha 时必填 | `10000000-...` | 返回给浏览器的 hCaptcha 公开站点密钥。 |
| `HCAPTCHA_SECRET_KEY` | 使用 hCaptcha 时必填 | `0x...` | 服务端用于验证 hCaptcha 令牌的密钥。 |

Turnstile 配置示例：

```env
CAPTCHA_PROVIDER=turnstile
TURNSTILE_SITE_KEY=your-site-key
TURNSTILE_SECRET_KEY=your-secret-key
```

hCaptcha 配置示例：

```env
CAPTCHA_PROVIDER=hcaptcha
HCAPTCHA_SITE_KEY=your-site-key
HCAPTCHA_SECRET_KEY=your-secret-key
```

仅限本地开发：

```env
CAPTCHA_PROVIDER=none
```

不要在公开生产部署中使用 `none`。

### Turso/libSQL 数据库

| 变量 | 必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| `TURSO_DATABASE_URL` | 是 | `libsql://your-db.turso.io` | libSQL/Turso 数据库地址。 |
| `TURSO_AUTH_TOKEN` | 是 | `eyJ...` | 数据库认证令牌。 |

应用会通过幂等 SQL 懒创建以下数据表：

- `jobs`
- `priority_usage`
- `app_settings`
- `admin_login_attempts`
- `job_rate_limits`

数据库结构位于 `src/lib/db.ts`。

生产环境说明：

- Vercel 函数不能依赖本地 SQLite 文件保存持久队列状态。
- 生产环境请使用 Turso/libSQL 保存队列状态。
- 不要将 `TURSO_AUTH_TOKEN` 存储在会暴露给客户端的变量中。

### 管理员后台

生产环境可以只保留少量引导环境变量，然后在后台配置模型、队列、验证码和优先队列。

| 变量 | 必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| `ADMIN_PATH` | 否 | `/aivroadmin` | 管理后台入口路径。为空时后台关闭。 |
| `ADMIN_PASSWORD` | 启用后台时必填 | `long-random-password` | 单管理员登录密码。 |
| `ADMIN_SESSION_SECRET` | 启用后台时必填 | `long-random-secret` | 用于签名 HttpOnly 登录 cookie。 |

启用后访问 `https://your-domain.com/aivroadmin`，登录后可以保存以下配置到 Turso 的 `app_settings` 表：

- 模型提供商：模型名称、API Base URL、API Key。
- 队列：并发数、最大等待数、轮询间隔、运行超时、结果保留时间。
- 优先队列：开关和每日次数。
- 验证码：none、Turnstile 或 hCaptcha 及对应密钥。
- IP 哈希盐值。

运行时读取顺序是：后台数据库配置优先，其次环境变量，最后使用默认值。保存后下一次请求生效，不需要重新部署 Vercel。

后台路径不是安全边界，真正的保护是 `ADMIN_PASSWORD` 和签名 cookie。请使用强密码，并保护好 Turso 访问令牌。

安全行为：

- 后台登录失败会按 IP 哈希限速，短时间多次失败会返回 `too_many_attempts`。
- 后台保存设置需要登录 cookie 和 CSRF token。
- 后台读取配置时 API Key 和验证码 secret 会脱敏显示；保存脱敏值会保留原 secret。
- 模型 API Base URL 必须是合法 HTTPS 地址。
- 公开生成接口会按 IP 哈希限制提交频率，防止验证码关闭时被刷队列。

## Vercel 部署

### 1. 创建 Turso 数据库

创建 Turso/libSQL 数据库，并准备：

- 数据库 URL，例如 `libsql://your-db.turso.io`
- 数据库认证令牌

生产环境不要使用 Vercel 本地文件保存队列状态。Vercel Free 的函数文件系统不适合做持久队列。

### 2. 创建 Vercel 项目

在 Vercel 中导入本仓库，Framework Preset 选择 Next.js。默认构建命令保持：

```bash
npm run build
```

### 3. 设置最小环境变量

最小生产环境变量：

```env
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-token

ADMIN_PATH=/aivroadmin
ADMIN_PASSWORD=use-a-long-random-password
ADMIN_SESSION_SECRET=use-a-long-random-secret-value
```

建议：

- `ADMIN_PATH` 使用不容易猜到的路径，例如 `/aivroadmin-随机后缀`。
- `ADMIN_PASSWORD` 使用长随机密码。
- `ADMIN_SESSION_SECRET` 使用至少 32 字符的随机字符串。

如果暂时不启用后台，也可以不设置 `ADMIN_PATH`，并继续用 `MODEL`、`KEY`、`API`、`CAPTCHA_PROVIDER`、`QUEUE_CONCURRENCY` 等环境变量运行。

### 4. 部署并进入后台

部署完成后访问：

```text
https://your-domain.com/aivroadmin
```

如果你把 `ADMIN_PATH` 设置成其他路径，就访问对应路径。

登录后先保存这些配置：

1. 模型：填写模型名称、HTTPS API Base URL、API Key。
2. 队列：建议先把 `Concurrency` 设置为 `1`，确认 provider 支持更高并发后再调大。
3. 验证码：公开站点建议选择 Turnstile 或 hCaptcha，不要使用 `none`。
4. 优先队列：按需要开启，并设置每日次数。
5. IP Hash Salt：使用一串固定随机值。

保存后下一次请求生效，不需要重新部署。

### 5. 生产检查

部署后建议检查：

- `/en-US` 能打开首页。
- `/api/models` 只返回模型 ID、名称和图标，不包含 API Key。
- 后台读取配置时 secret 显示为脱敏值。
- 连续输错后台密码多次后会返回 `too_many_attempts`。
- 公开生成接口在高频提交时会返回 `rate_limited`。

## API 概览

- `GET /api/config` 返回公开运行时配置、验证码站点密钥、轮询间隔、数据库结果保留时间和剩余优先次数。
- `GET /api/models` 返回公开模型 ID、名称和图标类型。
- `POST /api/jobs` 验证验证码、创建排队任务，并记录质量和比例。
- `GET /api/jobs/[id]` 推进队列，并返回任务状态、队列位置、运行中任务数、等待中任务数、过期时间和结果数据。
- `POST /api/admin/login` 验证管理员密码，成功后设置 HttpOnly session cookie 和 CSRF cookie。
- `POST /api/admin/logout` 需要管理员 session 和 CSRF token，用于退出后台。
- `GET /api/admin/settings` 需要管理员 session，返回脱敏后的后台配置。
- `PUT /api/admin/settings` 需要管理员 session 和 CSRF token，校验并保存后台配置。

常见错误码：

- `queue_full`：等待队列已满。
- `rate_limited`：当前 IP 提交过快。
- `too_many_attempts`：后台登录失败次数过多。
- `csrf_invalid`：后台写入请求缺少或携带了错误的 CSRF token。
- `database_unavailable`：数据库未配置或暂时不可用。

## 验证

```bash
npm test
npm run lint
npm run build
```

测试套件覆盖模型解析、模型图标、图片参数映射、验证码错误码、配置解析、管理员 session、限速、secret 脱敏和队列排序规则。
