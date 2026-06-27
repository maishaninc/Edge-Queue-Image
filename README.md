# Edge-Queue-Image · 免费 AI 生图站

一个部署在 **Vercel** + **Aiven PostgreSQL** 上的免费图片生成网站。前端 1:1 沿用 Aivro 的生图工作台、登录页与 anime.js 动画；后端用 Postgres 承载队列、用户、生图日志与运行时配置。

- **/image** 生图工作台（文生图 + 参考图编辑 + 历史记录侧栏）
- **/login** 登录页（Google / GitHub 第三方登录 + 管理员账号密码，含 anime.js 描边/入场动画）
- **/admin** 后台（用户管理 / 谷歌广告 / 模型配置 / 系统设置 / 生图日志 / 签到额度）
- 生成的图片与提示词、用户、记录 ID 全部入库，支持后台「生图日志」回看
- **每日签到**：管理员可设「每天固定额度」或「每天随机区间额度」；可选让生成按额度计费

## 需要 4 个环境变量

```env
# 1) Aiven PostgreSQL 连接串（建议用控制台的「连接池 / PgBouncer」URI 以适配 Serverless）
DATABASE_URL=postgres://avnadmin:password@host-xxxx.aivencloud.com:PORT/defaultdb?sslmode=require

# 2) Aiven 提供的 CA 证书（ca.pem 完整内容，含 BEGIN/END CERTIFICATE 行；Vercel 可直接粘贴多行）
DATABASE_CA_CERT=-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----

# 3) 管理员账号
ADMIN_USERNAME=admin

# 4) 管理员密码（部署后用它登录后台；每次部署都会以此为准同步管理员密码）
ADMIN_PASSWORD=your-strong-password
```

> OAuth 客户端密钥、模型 API Key、谷歌广告、验证码、签到额度等**全部在后台「系统设置」里填写并存入数据库**，不需要额外环境变量。

## 本地启动

```bash
npm install
# 在 .env.local 写入 DATABASE_URL（本地可直连 Aiven，或用本地 Postgres）
# 直连 Aiven 时同时写入 DATABASE_CA_CERT；本地无 SSL 的 Postgres 可不填
npm run dev
```

打开 http://localhost:3000 → 自动跳转 `/image`。首次访问会自动建表并创建默认管理员。

### 首次配置（重要）

1. 访问 `/login`，用环境变量里设置的 **`ADMIN_USERNAME` / `ADMIN_PASSWORD`** 登录后台 `/admin`。
2. 「模型配置」→ 新增渠道：填 `Base URL`（如 `https://api.openai.com/v1`）、`API Key`、模型（如 `gpt-image-1`）→ 在「对外可用模型」里把它加入可选模型并设为默认 → 保存。
3. 「第三方登录」→ 填 Google / GitHub 的 `Client ID` / `Client Secret` 并启用。页面会显示需要在 Google/GitHub 后台配置的**回调地址**：
   - Google：`https://你的域名/api/auth/oauth/google/callback`
   - GitHub：`https://你的域名/api/auth/oauth/github/callback`
4. （可选）「谷歌广告」→ 粘贴 AdSense 脚本、`ads.txt` 内容、勾选启用页面。
5. 退出后用 Google / GitHub 登录即可生图；后台「生图日志」可看到每位用户的图片、提示词与记录 ID。

## 部署到 Vercel

1. 新建 Vercel 项目，导入本仓库。
2. 在 Project Settings → Environment Variables 添加 **`DATABASE_URL`** 与 **`DATABASE_CA_CERT`**（CA 证书直接粘贴整段 PEM）。
3. 部署。首次请求会自动迁移数据库、创建默认管理员，随后按上面的「首次配置」操作。

> 建议在 Aiven 开启 **Connection pooling（PgBouncer）** 并使用其 URI，避免 Serverless 并发把连接数打满。

## 技术栈

Next.js 16 (App Router) · React 19 · TypeScript · Ant Design v6 + Pro Components · Tailwind v4 · zustand · TanStack Query · anime.js · node-postgres(pg)。

## 关键设计

- **鉴权**：自建 Google/GitHub OAuth（端点可在后台覆盖）+ 数据库 `sessions` 表 + HttpOnly Cookie；普通用户仅第三方登录，管理员用账号密码。
- **生图队列**：Serverless 无常驻 worker——有空闲槽位时在提交请求内同步出图；否则入队，由轮询推进（`generation_jobs`）。生图路由设置了 `maxDuration = 60`。
- **图片存储**：图片字节存入 Postgres（`generation_images`，带 `expires_at`），通过 `/api/images/[id]` 鉴权输出；读取时惰性清理过期数据。保留天数后台可配（默认 7 天）。
- **运行时配置**：`app_settings` 表的 `public` / `private` 两行 JSON，后台可改模型渠道、OAuth、验证码、广告、队列等，无需改环境变量。

## 数据表

`users` · `sessions` · `app_settings` · `generation_jobs` · `generation_histories` · `generation_images`（首次启动由 `src/lib/migrate.ts` 幂等创建）。
