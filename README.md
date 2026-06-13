# Aivro 图片生成器

这是一个基于 Next.js 的图片生成站点，内置兼容 Vercel 的队列、兼容 OpenAI 图片接口的模型提供商配置、Turnstile/hCaptcha 支持，以及 Turso/libSQL 持久化。

默认公开页面位于 `/en-US`，根路径 `/` 会跳转到 `/en-US`。用户提交提示词后，可以选择模型、质量、比例和每日优先队列，并轮询队列状态直到图片生成完成。

## 功能

- 使用 Next.js App Router 构建 `Aivro` 界面。
- 通过环境变量配置多个兼容 OpenAI 图片接口的模型提供商。
- 使用 Turso/libSQL 存储队列，适配无服务器运行环境。
- 图片结果临时保存到数据库，保留时间由 `JOB_RESULT_TTL_MINUTES` 控制。
- 浏览器使用 IndexedDB 保存本地历史任务和图片，直到用户手动删除。
- 可配置活跃生成并发数和最大等待队列长度。
- 可选每日优先队列，按 IP 哈希和协调世界时日期统计次数。
- 验证码提供商可切换为 `none`、`turnstile` 或 `hcaptcha`，前端使用弹窗验证。
- 支持 English、简体中文、繁體中文、日本語四种界面语言。

## 本地启动

```bash
npm install
cp .env.example .env.local
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

如果本地界面测试不需要验证码，请设置：

```env
CAPTCHA_PROVIDER=none
```

创建和轮询生成任务仍然需要 `TURSO_DATABASE_URL` 和 `TURSO_AUTH_TOKEN`，因为队列状态存储在 libSQL/Turso 中。

## 环境变量

### 模型提供商

应用会读取一组默认模型配置，以及可选的编号模型配置。

| 变量 | 必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| `MODEL` | 是 | `gpt-image-1` | 发送到兼容 OpenAI 图片接口的默认模型名称，对应请求中的 `model`。 |
| `KEY` | 是 | `sk-...` | 默认提供商的 API 密钥。仅在服务端使用，绝不暴露给浏览器。 |
| `API` | 是 | `https://api.openai.com` | 默认提供商的基础地址。应用会调用 `${API}/v1/images/generations`。 |
| `MODEL_1` | 否 | `provider-image-model` | 额外提供商的模型名称。 |
| `KEY_1` | 否 | `sk-...` | 额外提供商的 API 密钥。 |
| `API_1` | 否 | `https://example.com` | 额外提供商的基础地址。 |
| `MODEL_2` / `KEY_2` / `API_2` | 否 | | 继续编号即可配置更多提供商。 |

规则：

- 只有当某组配置同时存在 `MODEL`、`KEY` 和 `API` 时，该模型组才会启用。
- 编号模型组如果配置不完整，会被跳过。
- `API` 可以包含末尾斜杠，应用会自动规范化。
- 浏览器只会收到安全的模型 ID 和名称，不会收到 API 密钥。

最小 OpenAI 配置示例：

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

数据库结构位于 `src/lib/db.ts`。

生产环境说明：

- Vercel 函数不能依赖本地 SQLite 文件保存持久队列状态。
- 生产环境请使用 Turso/libSQL 保存队列状态。
- 不要将 `TURSO_AUTH_TOKEN` 存储在会暴露给客户端的变量中。

## Vercel 部署

1. 创建 Turso 数据库和认证令牌。
2. 基于本仓库创建 Vercel 项目。
3. 在 Vercel 项目设置中添加所有必需环境变量。
4. 公开部署请使用 `CAPTCHA_PROVIDER=turnstile` 或 `CAPTCHA_PROVIDER=hcaptcha`。
5. 部署项目。

最小生产环境变量：

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
JOB_RESULT_TTL_MINUTES=15
PRIORITY_QUEUE_ENABLED=true
PRIORITY_DAILY_LIMIT=1
IP_HASH_SALT=use-a-long-random-secret-value
```

## API 概览

- `GET /api/config` 返回公开运行时配置、验证码站点密钥、轮询间隔、数据库结果保留时间和剩余优先次数。
- `GET /api/models` 返回公开模型 ID、名称和图标类型。
- `POST /api/jobs` 验证验证码、创建排队任务，并记录质量和比例。
- `GET /api/jobs/[id]` 推进队列，并返回任务状态、队列位置、运行中任务数、等待中任务数、过期时间和结果数据。

## 验证

```bash
npm test
npm run build
```

测试套件覆盖模型解析、模型图标、图片参数映射、验证码错误码、配置解析和队列排序规则。
