export type Locale = "zh-CN" | "en-US";

export const localeLabels: Record<Locale, string> = {
  "zh-CN": "中文",
  "en-US": "English",
};

export const messages = {
  "zh-CN": {
    "app.name": "Aivro",
    "app.freeImage": "免费生成图片",
    "locale.switch": "切换语言",
    "common.login": "登录",
    "common.logout": "退出登录",
    "common.admin": "管理后台",
    "common.config": "配置",
    "common.loading": "加载中…",
    "theme.toLight": "切换到浅色主题",
    "theme.toDark": "切换到深色主题",
    "nav.image": "生图工作台",
    "login.signIn": "登录",
    "login.register": "注册",
    "login.withGoogle": "使用 Google 登录",
    "login.withGithub": "使用 GitHub 登录",
    "login.adminTitle": "管理员登录",
    "login.username": "用户名",
    "login.password": "密码",
    "login.submit": "登录",
    "login.required": "请先登录后再生成图片",
  },
  "en-US": {
    "app.name": "Aivro",
    "app.freeImage": "Free Image Generator",
    "locale.switch": "Switch language",
    "common.login": "Sign in",
    "common.logout": "Sign out",
    "common.admin": "Admin",
    "common.config": "Settings",
    "common.loading": "Loading…",
    "theme.toLight": "Switch to light theme",
    "theme.toDark": "Switch to dark theme",
    "nav.image": "Image Studio",
    "login.signIn": "Sign in",
    "login.register": "Register",
    "login.withGoogle": "Sign in with Google",
    "login.withGithub": "Sign in with GitHub",
    "login.adminTitle": "Admin sign in",
    "login.username": "Username",
    "login.password": "Password",
    "login.submit": "Sign in",
    "login.required": "Please sign in before generating images",
  },
} satisfies Record<Locale, Record<string, string>>;

export type MessageKey = keyof (typeof messages)["zh-CN"];
