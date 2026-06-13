export const SITE_NAME = 'Aivro Free Edge Queue Image';
export const DEFAULT_LOCALE = 'zh-CN';
export const LOCALES = ['zh-CN'] as const;

export type SiteLocale = (typeof LOCALES)[number];

export function isSiteLocale(locale: string): locale is SiteLocale {
  return LOCALES.includes(locale as SiteLocale);
}

export const COPY = {
  'zh-CN': {
    title: SITE_NAME,
    subtitle: '输入提示词，通过共享边缘队列生成图片。并发、等待人数、验证码和模型全部由环境变量控制。',
    promptLabel: '提示词',
    promptPlaceholder: '描述你想生成的图片，例如：一座雨夜里的未来城市，霓虹反射在玻璃幕墙上，电影感构图。',
    modelLabel: '模型',
    sizeLabel: '尺寸',
    priorityLabel: '使用优先队列',
    priorityHint: '今日剩余 {count} 次。优先队列会排到正在生成窗口之后。',
    submit: '提交生成',
    submitting: '提交中...',
    queueTitle: '队列状态',
    idleTitle: '等待提交',
    idleDescription: '提交后会显示排队位置、正在生成数量和结果。',
    statusQueued: '排队中',
    statusRunning: '正在生成',
    statusSucceeded: '生成完成',
    statusFailed: '生成失败',
    statusExpired: '任务超时',
    queuePosition: '排队位置',
    runningCount: '正在生成',
    waitingCount: '等待人数',
    download: '下载图片',
    copyUrl: '复制地址',
    copied: '已复制',
    again: '重新生成',
    queueFull: '当前人数过多，请稍后重试。',
    captchaFailed: '人机验证失败，请重试。',
    priorityLimit: '今日优先队列次数已用完。',
    modelMissing: '请选择可用模型。',
    invalidPrompt: '请输入有效提示词。',
    databaseUnavailable: '服务暂时不可用，请稍后重试。',
    providerFailed: '生成失败，请稍后重试。',
  },
} as const;

export function t(locale: SiteLocale, key: keyof (typeof COPY)['zh-CN']) {
  return COPY[locale][key];
}
