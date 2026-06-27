# Edge-Queue-Image · 免费 AI 生图站

一个部署在 **Vercel** + **Aiven PostgreSQL** 上的免费图片生成网站。前端为生图工作台 + 第三方登录 + anime.js 动画；后端用 Postgres 承载队列、用户、生图日志、签到额度与全部运行时配置。

## 功能特性

- **`/image` 生图工作台**：文生图 + 参考图编辑 + 历史记录侧栏 + 生成动画
- **`/login` 登录页**：Google / GitHub 第三方登录 + 管理员账号密码登录（含描边/入场动画）
- **`/admin` 后台**：用户管理 · 谷歌广告 · 模型配置 · 系统设置 · 生图日志 · 签到额度
- **生图日志**：每次生成的图片、提示词、用户、记录 ID 全部入库，后台可回看
- **每日签到**：管理员可设「每天固定额度」或「每天随机区间额度」；可选让生成按额度计费
- **运行时配置**：OAuth 密钥、模型 API Key、广告、验证码、签到等都在后台填写并存数据库，改配置无需改环境变量
- **安全**：会话 HttpOnly Cookie、OAuth state 防 CSRF、登录按 IP 防爆破、图片接口防 XSS/越权、provider 防 SSRF、密钥不回传浏览器

---

## 环境变量（共 4 个，全部必填）

| 变量 | 说明 | 示例 / 获取方式 |
|---|---|---|
| `DATABASE_URL` | Aiven PostgreSQL 连接串。**Serverless 建议用连接池(PgBouncer)的 URI** | `postgres://avnadmin:pwd@pg-xxx.aivencloud.com:12345/defaultdb?sslmode=require` |
| `DATABASE_CA_CERT` | Aiven 的 CA 证书 `ca.pem` 的**完整内容**（含 `-----BEGIN/END CERTIFICATE-----`），用于校验 TLS | 见下方「准备 Aiven」第 4 步 |
| `ADMIN_USERNAME` | 管理员登录用户名 | `admin` |
| `ADMIN_PASSWORD` | 管理员登录密码（每次部署都会以此为准同步） | 设一个强密码 |

> 其余所有密钥（OAuth Client Secret、模型 API Key、验证码 Secret、广告代码、签到额度）都在后台「系统设置」里填写，**不进环境变量**。

---

## 部署教程

### 一、准备 Aiven PostgreSQL

1. 登录 [aiven.io](https://aiven.io) → **Create service** → 选 **PostgreSQL** → 选区域和套餐（免费/Hobbyist 即可）→ 创建，等服务变成 `Running`。
2. 进入服务的 **Overview** 页，找到 **Connection information**。
3. 复制 **Service URI**（形如 `postgres://avnadmin:...@pg-xxx.aivencloud.com:PORT/defaultdb?sslmode=require`）→ 这就是 `DATABASE_URL`。
   - **（推荐）连接池**：左侧 **Pools** → **Create pool**（数据库选 `defaultdb`，模式 `transaction`）→ 用池子的 URI 作为 `DATABASE_URL`，更适合 Serverless 高并发。
4. 在 Overview 的 Connection information 里点 **CA Certificate → Download**（得到 `ca.pem`）→ 用文本编辑器打开，**复制全部内容**（包含首尾的 `-----BEGIN CERTIFICATE-----` / `-----END CERTIFICATE-----`）→ 这就是 `DATABASE_CA_CERT`。

### 二、申请 Google / GitHub 登录（可后置，部署后再配也行）

> 回调地址里的 `你的域名` 部署后才确定（Vercel 会给一个 `xxx.vercel.app`，或绑定自有域名）。可先用 Vercel 域名，绑定自有域名后再改。

**Google：**
1. [Google Cloud Console](https://console.cloud.google.com/) → 新建项目 → **APIs & Services → Credentials**。
2. **Create Credentials → OAuth client ID** → 类型选 **Web application**。
3. **Authorized redirect URIs** 填：`https://你的域名/api/auth/oauth/google/callback`
4. 创建后拿到 **Client ID** 和 **Client Secret**（后台填）。

**GitHub：**
1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**。
2. **Authorization callback URL** 填：`https://你的域名/api/auth/oauth/github/callback`
3. 创建后拿到 **Client ID**，再 **Generate a new client secret** 拿到 **Client Secret**（后台填）。

### 三、部署到 Vercel

1. 把本仓库推到 GitHub → 在 [vercel.com](https://vercel.com) **Add New → Project → Import** 该仓库（框架会自动识别 Next.js）。
2. 展开 **Environment Variables**，添加上面 4 个变量：
   - `DATABASE_URL`、`ADMIN_USERNAME`、`ADMIN_PASSWORD` 直接填。
   - `DATABASE_CA_CERT` **把整段 PEM 粘进去**（Vercel 的值支持多行/换行，直接粘贴 `ca.pem` 全文即可）。
3. **Deploy**。首次访问会自动建表、创建管理员，无需手动初始化数据库。
4. 部署成功后访问站点根路径会跳到 `/image`。

> 仓库已内置 `.npmrc`（`legacy-peer-deps=true`）解决 antd v6 与 pro-components 的 peer 依赖冲突，Vercel 安装会直接通过。生图接口已设 `maxDuration = 60`（Hobby 套餐允许到 60s；Pro 可更高）。

### 四、首次后台配置

1. 打开 `https://你的域名/login`，用 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录 → 进入 `/admin`。
2. **模型配置**：新增渠道 → 填 `Base URL`（如 `https://api.openai.com/v1`）、`API Key`、模型（如 `gpt-image-1`）→ 点「测试」确认可用 → 在「对外可用模型」勾选它并设为默认 → 保存。
3. **第三方登录**：填 Google / GitHub 的 Client ID / Client Secret 并开启。页面会显示**回调地址**，确保和你在 Google/GitHub 后台填的一致。
   - 若用自有域名，建议在 **系统设置 → 运行配置 → 站点域名(appOrigin)** 填正式域名（用于拼回调地址）。
4. **签到额度**（可选）：开启签到 → 选「固定额度」或「随机区间额度」→ 如需付费生成，把「每张图片消耗额度」设为 >0。
5. **谷歌广告**（可选）：粘贴 AdSense 脚本、`ads.txt` 内容、勾选展示页面。
6. **验证码**（可选）：选 Turnstile / hCaptcha，填 Site Key + Secret Key。
7. 退出后即可用 Google / GitHub 登录生图；后台「生图日志」可看到每位用户的图片、提示词与记录 ID。

### 五、本地开发

```bash
npm install            # 仓库内置 .npmrc，已处理依赖冲突
cp .env.example .env.local   # 填入 4 个变量（本地无 SSL 的 Postgres 可不填 DATABASE_CA_CERT）
npm run dev            # http://localhost:3000
```

---

## 架构与技术栈

Next.js 16 (App Router) · React 19 · TypeScript · Ant Design v6 + Pro Components · Tailwind v4 · zustand · TanStack Query · anime.js · node-postgres(pg)。

- **鉴权**：自建 Google/GitHub OAuth（端点可在后台覆盖）+ 数据库 `sessions` 表 + HttpOnly Cookie；普通用户仅第三方登录，管理员用账号密码。
- **生图队列**：Serverless 无常驻 worker——有空闲槽位时在提交请求内同步出图；否则入队，由前端轮询推进（`generation_jobs`）。
- **图片存储**：图片字节存入 Postgres（`generation_images`，带 `expires_at`），经 `/api/images/[id]` 鉴权输出，读取时惰性清理过期数据；保留天数后台可配（默认 7 天）。
- **配置**：`app_settings` 表的 `public` / `private` 两行 JSON，后台改完即生效。

### 数据表

`users` · `sessions` · `app_settings` · `login_attempts` · `generation_jobs` · `generation_histories` · `generation_images`（首次启动由 `src/lib/migrate.ts` 幂等创建，旧库自动 `ALTER TABLE` 补列）。

---

## 常见问题

- **Vercel 安装报 `ERESOLVE` peer 冲突**：仓库已带 `.npmrc`（`legacy-peer-deps=true`）；若仍报错，确认该文件在仓库根目录并已提交。
- **数据库连不上 / TLS 报错**：确认 `DATABASE_CA_CERT` 是 `ca.pem` 的完整 PEM；或临时用带 `?sslmode=require` 的 URI。Serverless 连接数报满时改用 Aiven 连接池 URI。
- **OAuth 登录回调 400 / redirect 不匹配**：Google/GitHub 后台的回调地址必须**精确等于** `https://域名/api/auth/oauth/{google|github}/callback`；并在后台「运行配置」把 `appOrigin` 设为正式域名。
- **进不了后台**：用环境变量里的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录；改了 `ADMIN_PASSWORD` 后重新部署即生效。
- **生成超时**：图片接口上限 60s；若模型很慢，升级 Vercel 套餐或更换更快的渠道。
