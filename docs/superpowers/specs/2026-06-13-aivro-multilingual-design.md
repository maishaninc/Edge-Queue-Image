# Aivro 多语言设计

日期：2026-06-13

## 目标

参考 `D:\Github\MX-Insight-Web` 的多语言结构，为 Aivro 增加四种语言：

- English
- 简体中文
- 繁體中文
- 日本語

默认语言改为 English，对应路由 `/en-US`。根路径 `/` 跳转到 `/en-US`。

## 路由与 Locale

使用和参考项目一致的 locale 标识：

```ts
LOCALES = ['en-US', 'zh-CN', 'zh-TW', 'ja']
DEFAULT_LOCALE = 'en-US'
```

支持路径：

- `/en-US`
- `/zh-CN`
- `/zh-TW`
- `/ja`

非法 locale 继续返回 404。

## 语言切换器

复用参考项目的交互模式：

- 当前语言按钮。
- 下拉菜单显示四种语言。
- 切换时替换 URL 第一段 locale。
- 保留当前 `search` 和 `hash`。

语言标签：

- `en-US`: `English`
- `zh-CN`: `简体中文`
- `zh-TW`: `繁體中文`
- `ja`: `日本語`

## SEO 与 Metadata

`i18n.ts` 增加：

- `LANGUAGE_LABELS`
- `SEO_COPY`
- `OG_LOCALE_BY_LOCALE`
- `relativeLocalePath`
- `relativeLanguageAlternates`
- `absoluteLocaleUrl`

`src/app/[locale]/page.tsx` 增加：

- `generateStaticParams`
- `generateMetadata`

`src/app/layout.tsx` 通过 `proxy.ts` 写入的 `x-pathname` 判断当前 locale，并设置 `<html lang={locale}>`。

## 文案

`COPY` 扩展为四套完整 UI 文案。覆盖：

- 生成器
- 队列状态
- 验证码弹窗
- 本地历史
- 功能区
- 对比区
- Q&A
- 错误提示

所有用户可见文本都从 `COPY[locale]` 或 `SEO_COPY[locale]` 读取，不在组件中写死中文页脚。

## 测试

需要覆盖：

- `isSiteLocale`
- `localeFromPathname`
- `relativeLanguageAlternates`
- 语言切换器保持 locale 列表可用

最终运行：

```bash
npm test
npm run lint
npm run build
```
