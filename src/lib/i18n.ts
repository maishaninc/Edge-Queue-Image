export const SITE_URL = 'https://edge.aivro.org';
export const SITE_NAME = 'Aivro';

// Shared product surfaces used by the top navigation.
export const PRODUCT_BASE = 'https://aivro.org';
export const EDGE_IMAGE_URL = 'https://edge.aivro.org';
export const INSIGHT_URL = 'https://insight.aivro.org';

export type NavLink = {
  label: string;
  href: string;
  active?: boolean;
};

export const NAV_LINKS: Record<SiteLocale, NavLink[]> = {
  'en-US': [
    { label: 'Workflow', href: `${PRODUCT_BASE}/canvas` },
    { label: 'Image Studio', href: `${PRODUCT_BASE}/image` },
    { label: 'Video Studio', href: `${PRODUCT_BASE}/video` },
    { label: 'Model Studio', href: `${PRODUCT_BASE}/to-3d` },
    { label: 'Prompt Library', href: `${PRODUCT_BASE}/prompts` },
    { label: 'My Assets', href: `${PRODUCT_BASE}/assets` },
    { label: 'Free Image Generation', href: EDGE_IMAGE_URL, active: true },
    { label: 'Prompt Reverse', href: `${INSIGHT_URL}` },
  ],
  'zh-CN': [
    { label: '工作流', href: `${PRODUCT_BASE}/canvas` },
    { label: '生图工作台', href: `${PRODUCT_BASE}/image` },
    { label: '视频创作台', href: `${PRODUCT_BASE}/video` },
    { label: '模型工作台', href: `${PRODUCT_BASE}/to-3d` },
    { label: '提示词库', href: `${PRODUCT_BASE}/prompts` },
    { label: '我的素材', href: `${PRODUCT_BASE}/assets` },
    { label: '免费生成图片', href: EDGE_IMAGE_URL, active: true },
    { label: '提示词反推', href: `${INSIGHT_URL}` },
  ],
  'zh-TW': [
    { label: '工作流', href: `${PRODUCT_BASE}/canvas` },
    { label: '生圖工作台', href: `${PRODUCT_BASE}/image` },
    { label: '影片創作台', href: `${PRODUCT_BASE}/video` },
    { label: '模型工作台', href: `${PRODUCT_BASE}/to-3d` },
    { label: '提示詞庫', href: `${PRODUCT_BASE}/prompts` },
    { label: '我的素材', href: `${PRODUCT_BASE}/assets` },
    { label: '免費生成圖片', href: EDGE_IMAGE_URL, active: true },
    { label: '提示詞反推', href: `${INSIGHT_URL}` },
  ],
  ja: [
    { label: 'ワークフロー', href: `${PRODUCT_BASE}/canvas` },
    { label: '画像スタジオ', href: `${PRODUCT_BASE}/image` },
    { label: '動画スタジオ', href: `${PRODUCT_BASE}/video` },
    { label: 'モデルスタジオ', href: `${PRODUCT_BASE}/to-3d` },
    { label: 'プロンプト集', href: `${PRODUCT_BASE}/prompts` },
    { label: 'マイ素材', href: `${PRODUCT_BASE}/assets` },
    { label: '無料画像生成', href: EDGE_IMAGE_URL, active: true },
    { label: 'プロンプト解析', href: `${INSIGHT_URL}` },
  ],
};

export const LOCALES = ['en-US', 'zh-CN', 'zh-TW', 'ja'] as const;
export const DEFAULT_LOCALE: SiteLocale = 'en-US';

export type SiteLocale = (typeof LOCALES)[number];

export const LANGUAGE_LABELS: Record<SiteLocale, string> = {
  'en-US': 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
};

export const OG_LOCALE_BY_LOCALE: Record<SiteLocale, string> = {
  'en-US': 'en_US',
  'zh-CN': 'zh_CN',
  'zh-TW': 'zh_TW',
  ja: 'ja_JP',
};

export type SeoCopy = {
  title: string;
  description: string;
  keywords: string[];
};

export const SEO_COPY: Record<SiteLocale, SeoCopy> = {
  'en-US': {
    title: 'Aivro | Queue-Based AI Image Generator',
    description:
      'Aivro is an AI image generator with transparent queue status, captcha protection, local browser history, temporary database result retention, and multiple OpenAI-compatible model providers.',
    keywords: ['AI image generator', 'queue image generator', 'OpenAI-compatible image model', 'local image history', 'Turnstile', 'hCaptcha'],
  },
  'zh-CN': {
    title: 'Aivro | 队列式 AI 图片生成器',
    description: 'Aivro 是支持透明队列、验证码保护、本地浏览器历史、数据库临时保存和多 OpenAI 兼容模型提供商的 AI 图片生成器。',
    keywords: ['AI图片生成', '队列图片生成', 'OpenAI兼容模型', '本地图片历史', 'Turnstile', 'hCaptcha'],
  },
  'zh-TW': {
    title: 'Aivro | 佇列式 AI 圖片生成器',
    description: 'Aivro 是支援透明佇列、驗證碼保護、本機瀏覽器歷史、資料庫暫存和多 OpenAI 相容模型供應商的 AI 圖片生成器。',
    keywords: ['AI圖片生成', '佇列圖片生成', 'OpenAI相容模型', '本機圖片歷史', 'Turnstile', 'hCaptcha'],
  },
  ja: {
    title: 'Aivro | キュー型 AI 画像生成ツール',
    description:
      'Aivro は、透明なキュー状態、Captcha 保護、ブラウザ内ローカル履歴、一時的なデータベース保存、複数の OpenAI 互換モデルに対応した AI 画像生成ツールです。',
    keywords: ['AI画像生成', 'キュー画像生成', 'OpenAI互換モデル', 'ローカル画像履歴', 'Turnstile', 'hCaptcha'],
  },
};

type FeatureCopy = {
  title: string;
  description: string;
};

type CompareRowCopy = {
  feature: string;
  aivro: string;
  other: string;
};

type FaqCopy = {
  question: string;
  answer: string;
};

export type LocaleCopy = {
  title: string;
  subtitle: string;
  freeGenerate: string;
  heroTagline: string;
  promptBarPlaceholder: string;
  generatingTitle: string;
  generatingHint: string;
  queueWaitingTitle: string;
  queueRankText: string;
  startingTitle: string;
  navMenu: string;
  promptLabel: string;
  promptPlaceholder: string;
  modelLabel: string;
  qualityLabel: string;
  aspectRatioLabel: string;
  sizeLabel: string;
  priorityLabel: string;
  priorityHint: string;
  submit: string;
  submitting: string;
  confirmGenerate: string;
  cancel: string;
  close: string;
  queueTitle: string;
  idleTitle: string;
  idleDescription: string;
  statusQueued: string;
  statusRunning: string;
  statusSucceeded: string;
  statusFailed: string;
  statusExpired: string;
  queuePosition: string;
  runningCount: string;
  waitingCount: string;
  ttlNotice: string;
  download: string;
  copyUrl: string;
  copied: string;
  again: string;
  resultAlt: string;
  queueFull: string;
  captchaFailed: string;
  captchaMissing: string;
  captchaSecretMissing: string;
  captchaUnreachable: string;
  captchaInvalid: string;
  priorityLimit: string;
  modelMissing: string;
  invalidPrompt: string;
  invalidImageOptions: string;
  databaseUnavailable: string;
  providerFailed: string;
  jobExpired: string;
  captchaTitle: string;
  captchaDescription: string;
  historyEyebrow: string;
  historyTitle: string;
  historyDescription: string;
  historyUnavailable: string;
  historySaveFailed: string;
  historyEmpty: string;
  historyImageAlt: string;
  historyClearConfirm: string;
  preview: string;
  reuse: string;
  delete: string;
  clearHistory: string;
  expandHistory: string;
  collapseHistory: string;
  featuresEyebrow: string;
  featuresTitle: string;
  features: FeatureCopy[];
  compareEyebrow: string;
  compareTitle: string;
  compareFeature: string;
  compareOther: string;
  compareRows: CompareRowCopy[];
  faqTitle: string;
  faq: FaqCopy[];
  footer: string;
};

const enUS: LocaleCopy = {
  title: SITE_NAME,
  subtitle:
    'Enter a prompt, choose a model, quality, and aspect ratio, then generate images through a shared queue. Results are temporarily stored in the database and saved to your browser history until you delete them.',
  freeGenerate: 'Free image generation',
  heroTagline: 'Type a prompt, send it through the shared queue, and watch your image come to life.',
  promptBarPlaceholder: 'Describe the image you want to create...',
  generatingTitle: 'Generating your image',
  generatingHint: 'The model is painting your prompt. This usually takes a few seconds.',
  queueWaitingTitle: 'Waiting in queue',
  queueRankText: 'Your position: #{rank}',
  startingTitle: 'Preparing your request',
  navMenu: 'Menu',
  promptLabel: 'Prompt',
  promptPlaceholder: 'Describe the image you want, for example: a futuristic city on a rainy night, neon reflections on glass towers, cinematic composition.',
  modelLabel: 'Model',
  qualityLabel: 'Quality',
  aspectRatioLabel: 'Aspect ratio',
  sizeLabel: 'Size',
  priorityLabel: 'Use priority queue',
  priorityHint: '{count} priority uses left today. Priority jobs start after the protected running window.',
  submit: 'Generate image',
  submitting: 'Submitting...',
  confirmGenerate: 'Confirm generation',
  cancel: 'Cancel',
  close: 'Close',
  queueTitle: 'Queue status',
  idleTitle: 'Waiting for submission',
  idleDescription: 'After submission, you will see queue position, active jobs, database retention countdown, and the result.',
  statusQueued: 'Queued',
  statusRunning: 'Generating',
  statusSucceeded: 'Completed',
  statusFailed: 'Failed',
  statusExpired: 'Timed out',
  queuePosition: 'Queue position',
  runningCount: 'Running',
  waitingCount: 'Waiting',
  ttlNotice: 'The database result will be deleted in {time}. Local history is not affected.',
  download: 'Download',
  copyUrl: 'Copy URL',
  copied: 'Copied',
  again: 'Generate again',
  resultAlt: 'Generated result',
  queueFull: 'The queue is busy. Please try again later.',
  captchaFailed: 'Human verification failed. Please try again.',
  captchaMissing: 'Please complete human verification first.',
  captchaSecretMissing: 'Captcha service is not fully configured. Please contact the site administrator.',
  captchaUnreachable: 'Captcha service is temporarily unavailable. Please try again later.',
  captchaInvalid: 'Human verification did not pass. Please verify again.',
  priorityLimit: 'Your priority queue uses for today are exhausted.',
  modelMissing: 'Please choose an available model.',
  invalidPrompt: 'Please enter a valid prompt.',
  invalidImageOptions: 'Please choose a valid quality and aspect ratio.',
  databaseUnavailable: 'Service is temporarily unavailable. Please try again later.',
  providerFailed: 'Generation failed. Some models may not support the selected quality or aspect ratio.',
  jobExpired: 'The task or image has expired. Please generate again.',
  captchaTitle: 'Complete human verification',
  captchaDescription: 'After verification, the generation task will be submitted immediately. The captcha token is only used for this request.',
  historyEyebrow: 'Local History',
  historyTitle: 'Browser local history',
  historyDescription: 'Successful generations are saved to your browser IndexedDB and are not affected by the 15-minute database retention window.',
  historyUnavailable: 'This browser cannot read local history.',
  historySaveFailed: 'The image was generated, but it could not be saved to local history. The remote image may block browser access.',
  historyEmpty: 'No local history yet. Successful generations will appear here automatically.',
  historyImageAlt: 'History image',
  historyClearConfirm: 'Clear all local history? This cannot be undone.',
  preview: 'Preview',
  reuse: 'Reuse',
  delete: 'Delete',
  clearHistory: 'Clear history',
  expandHistory: 'View all history',
  collapseHistory: 'Collapse history',
  featuresEyebrow: 'Features',
  featuresTitle: 'Designed for a public free generation queue',
  features: [
    { title: 'Transparent queue', description: 'Show queue position, waiting count, and active generation count after submission.' },
    { title: 'Multiple models', description: 'Configure multiple OpenAI-compatible image providers through environment variables.' },
    { title: 'Temporary database retention', description: 'Image results are retained according to JOB_RESULT_TTL_MINUTES to control database usage.' },
    { title: 'Local history', description: 'IndexedDB stores images and parameters locally, even after database cleanup.' },
    { title: 'Captcha protection', description: 'Turnstile and hCaptcha run in a modal flow with clearer failure reasons.' },
    { title: 'Quality and ratio', description: 'Quickly choose 1K, 2K, 4K and common aspect ratios for different model capabilities.' },
  ],
  compareEyebrow: 'Compare',
  compareTitle: 'Aivro vs ordinary temporary generators',
  compareFeature: 'Capability',
  compareOther: 'Ordinary generator',
  compareRows: [
    { feature: 'Queue status', aivro: 'Position and concurrency are visible', other: 'Usually only shows waiting' },
    { feature: 'Image storage', aivro: 'Temporary database storage plus persistent local history', other: 'Often lost after refresh' },
    { feature: 'Model setup', aivro: 'Multi-provider environment config', other: 'Usually fixed model' },
    { feature: 'Captcha', aivro: 'Modal verification and specific errors', other: 'Failure reason is unclear' },
    { feature: 'Options', aivro: 'Quality and ratio quick controls', other: 'Limited or hidden parameters' },
  ],
  faqTitle: 'Q&A',
  faq: [
    { question: 'How long are images stored in the database?', answer: 'JOB_RESULT_TTL_MINUTES controls it. The default is 15 minutes. Expired jobs are cleaned during submission, polling, or queue advancement.' },
    { question: 'Does local history expire automatically?', answer: 'No. Local history is stored in your browser IndexedDB until you delete entries, clear all history, or clear site data.' },
    { question: 'Why can some quality or aspect ratio options fail?', answer: 'OpenAI-compatible providers do not all support the same sizes. Try 1K or a common 1:1 ratio if a model fails.' },
    { question: 'What if captcha still fails after completion?', answer: 'The new flow distinguishes missing token, missing secret, unreachable verification service, and invalid verification. In production, make sure the site key is bound to the correct domain.' },
  ],
  footer: 'Queue image generation · Local history cache',
};

const zhCN: LocaleCopy = {
  title: SITE_NAME,
  subtitle: '输入提示词，选择模型、质量和比例，通过共享队列生成图片。结果会临时保存在数据库，同时永久缓存到你的浏览器历史中，直到你手动删除。',
  freeGenerate: '免费生成图片',
  heroTagline: '输入提示词，通过共享队列发送，实时见证你的图片诞生。',
  promptBarPlaceholder: '描述你想要生成的图片...',
  generatingTitle: '正在为你生成图片',
  generatingHint: '模型正在绘制你的提示词，通常只需几秒钟。',
  queueWaitingTitle: '正在排队中',
  queueRankText: '当前排名：第 {rank} 位',
  startingTitle: '正在准备你的请求',
  navMenu: '菜单',
  promptLabel: '提示词',
  promptPlaceholder: '描述你想生成的图片，例如：一座雨夜里的未来城市，霓虹反射在玻璃幕墙上，电影感构图。',
  modelLabel: '模型',
  qualityLabel: '质量',
  aspectRatioLabel: '比例',
  sizeLabel: '尺寸',
  priorityLabel: '使用优先队列',
  priorityHint: '今日剩余 {count} 次。优先队列会排到正在生成窗口之后。',
  submit: '生成图片',
  submitting: '提交中...',
  confirmGenerate: '确认生成',
  cancel: '取消',
  close: '关闭',
  queueTitle: '队列状态',
  idleTitle: '等待提交',
  idleDescription: '提交后会显示排队位置、正在生成数量、数据库保留倒计时和结果。',
  statusQueued: '排队中',
  statusRunning: '正在生成',
  statusSucceeded: '生成完成',
  statusFailed: '生成失败',
  statusExpired: '任务超时',
  queuePosition: '排队位置',
  runningCount: '正在生成',
  waitingCount: '等待人数',
  ttlNotice: '数据库结果将在 {time} 后自动删除。本地历史不受影响。',
  download: '下载图片',
  copyUrl: '复制地址',
  copied: '已复制',
  again: '重新生成',
  resultAlt: '生成结果',
  queueFull: '当前人数过多，请稍后重试。',
  captchaFailed: '人机验证失败，请重试。',
  captchaMissing: '请先完成人机验证。',
  captchaSecretMissing: '验证码服务配置不完整，请联系站点管理员。',
  captchaUnreachable: '验证码服务暂时不可用，请稍后重试。',
  captchaInvalid: '人机验证未通过，请重新验证。',
  priorityLimit: '今日优先队列次数已用完。',
  modelMissing: '请选择可用模型。',
  invalidPrompt: '请输入有效提示词。',
  invalidImageOptions: '请选择有效的质量和比例。',
  databaseUnavailable: '服务暂时不可用，请稍后重试。',
  providerFailed: '生成失败，请稍后重试。部分模型可能不支持当前质量或比例。',
  jobExpired: '任务或图片已过期，请重新生成。',
  captchaTitle: '完成人机验证',
  captchaDescription: '验证通过后会立即提交生成任务。验证码 token 只用于本次请求。',
  historyEyebrow: 'Local History',
  historyTitle: '浏览器本地历史',
  historyDescription: '生成成功后，图片和任务参数会保存到你的浏览器 IndexedDB，不受数据库 15 分钟保留时间影响。',
  historyUnavailable: '当前浏览器无法读取本地历史。',
  historySaveFailed: '图片已生成，但无法保存到本地历史。远程图片可能限制了浏览器读取。',
  historyEmpty: '还没有本地历史。生成成功后会自动出现在这里。',
  historyImageAlt: '历史图片',
  historyClearConfirm: '确定要清空本地历史吗？此操作无法撤销。',
  preview: '预览',
  reuse: '再次生成',
  delete: '删除',
  clearHistory: '清空历史',
  expandHistory: '查看全部历史',
  collapseHistory: '收起历史',
  featuresEyebrow: 'Features',
  featuresTitle: '为公开免费生成队列设计',
  features: [
    { title: '透明队列', description: '提交后显示排队位置、等待人数和正在生成数量，用户能知道任务在哪里。' },
    { title: '多模型配置', description: '通过环境变量配置多个兼容 OpenAI 图片接口的模型提供商。' },
    { title: '临时数据库保存', description: '图片结果按 JOB_RESULT_TTL_MINUTES 临时保留，降低数据库长期占用。' },
    { title: '本地历史', description: '浏览器 IndexedDB 保存图片和参数，数据库清理后仍可本地查看。' },
    { title: '验证码保护', description: 'Turnstile 和 hCaptcha 弹窗验证，失败原因更清晰。' },
    { title: '质量与比例', description: '快捷选择 1K、2K、4K 和常用比例，适配不同模型能力。' },
  ],
  compareEyebrow: 'Compare',
  compareTitle: 'Aivro 与普通临时生成页',
  compareFeature: '能力',
  compareOther: '普通生成页',
  compareRows: [
    { feature: '队列状态', aivro: '显示位置和并发状态', other: '通常只显示等待中' },
    { feature: '图片保存', aivro: '数据库临时保存，本地历史长期保存', other: '刷新后容易丢失' },
    { feature: '模型配置', aivro: '环境变量多提供商', other: '多为固定模型' },
    { feature: '验证码', aivro: '弹窗验证和细分错误', other: '失败原因不明确' },
    { feature: '参数选择', aivro: '质量和比例快捷切换', other: '参数有限或隐藏' },
  ],
  faqTitle: '常见问题',
  faq: [
    { question: '数据库里的图片会保存多久？', answer: '由 JOB_RESULT_TTL_MINUTES 控制，默认 15 分钟。过期任务会在提交、轮询或推进队列时被清理。' },
    { question: '本地历史会自动删除吗？', answer: '不会。本地历史保存在你的浏览器 IndexedDB 中，直到你删除单条历史、清空历史或清除浏览器站点数据。' },
    { question: '为什么某些质量或比例会生成失败？', answer: '不同 OpenAI-compatible provider 支持的尺寸不完全一致。失败时可以切换到 1K 或更常见的 1:1 比例。' },
    { question: '完成验证码后仍失败怎么办？', answer: '新版会区分未完成验证、密钥缺失、验证服务不可达和验证未通过。生产环境还需要确保站点密钥绑定了正确域名。' },
  ],
  footer: '队列图片生成 · 本地历史缓存',
};

const zhTW: LocaleCopy = {
  ...zhCN,
  subtitle: '輸入提示詞，選擇模型、品質和比例，透過共享佇列生成圖片。結果會暫時保存在資料庫，同時永久快取到你的瀏覽器歷史中，直到你手動刪除。',
  freeGenerate: '免費生成圖片',
  heroTagline: '輸入提示詞，透過共享佇列發送，即時見證你的圖片誕生。',
  promptBarPlaceholder: '描述你想要生成的圖片...',
  generatingTitle: '正在為你生成圖片',
  generatingHint: '模型正在繪製你的提示詞，通常只需幾秒鐘。',
  queueWaitingTitle: '正在排隊中',
  queueRankText: '目前排名：第 {rank} 位',
  startingTitle: '正在準備你的請求',
  navMenu: '選單',
  promptLabel: '提示詞',
  promptPlaceholder: '描述你想生成的圖片，例如：一座雨夜裡的未來城市，霓虹反射在玻璃帷幕上，電影感構圖。',
  qualityLabel: '品質',
  aspectRatioLabel: '比例',
  priorityLabel: '使用優先佇列',
  priorityHint: '今日剩餘 {count} 次。優先佇列會排到正在生成視窗之後。',
  submit: '生成圖片',
  submitting: '提交中...',
  confirmGenerate: '確認生成',
  queueTitle: '佇列狀態',
  idleTitle: '等待提交',
  idleDescription: '提交後會顯示排隊位置、正在生成數量、資料庫保留倒數和結果。',
  statusQueued: '排隊中',
  statusRunning: '正在生成',
  statusSucceeded: '生成完成',
  statusFailed: '生成失敗',
  statusExpired: '任務逾時',
  queuePosition: '排隊位置',
  runningCount: '正在生成',
  waitingCount: '等待人數',
  ttlNotice: '資料庫結果將在 {time} 後自動刪除。本機歷史不受影響。',
  download: '下載圖片',
  copied: '已複製',
  again: '重新生成',
  queueFull: '目前人數過多，請稍後重試。',
  captchaMissing: '請先完成人機驗證。',
  captchaSecretMissing: '驗證碼服務設定不完整，請聯絡站點管理員。',
  captchaUnreachable: '驗證碼服務暫時無法使用，請稍後重試。',
  captchaInvalid: '人機驗證未通過，請重新驗證。',
  priorityLimit: '今日優先佇列次數已用完。',
  modelMissing: '請選擇可用模型。',
  invalidPrompt: '請輸入有效提示詞。',
  invalidImageOptions: '請選擇有效的品質和比例。',
  databaseUnavailable: '服務暫時無法使用，請稍後重試。',
  providerFailed: '生成失敗，請稍後重試。部分模型可能不支援目前品質或比例。',
  jobExpired: '任務或圖片已過期，請重新生成。',
  captchaTitle: '完成人機驗證',
  captchaDescription: '驗證通過後會立即提交生成任務。驗證碼 token 僅用於本次請求。',
  historyTitle: '瀏覽器本機歷史',
  historyDescription: '生成成功後，圖片和任務參數會保存到你的瀏覽器 IndexedDB，不受資料庫 15 分鐘保留時間影響。',
  historyUnavailable: '目前瀏覽器無法讀取本機歷史。',
  historySaveFailed: '圖片已生成，但無法保存到本機歷史。遠端圖片可能限制了瀏覽器讀取。',
  historyEmpty: '還沒有本機歷史。生成成功後會自動出現在這裡。',
  historyImageAlt: '歷史圖片',
  historyClearConfirm: '確定要清空本機歷史嗎？此操作無法復原。',
  preview: '預覽',
  reuse: '再次生成',
  delete: '刪除',
  clearHistory: '清空歷史',
  expandHistory: '查看全部歷史',
  collapseHistory: '收起歷史',
  featuresTitle: '為公開免費生成佇列設計',
  features: [
    { title: '透明佇列', description: '提交後顯示排隊位置、等待人數和正在生成數量，使用者能知道任務在哪裡。' },
    { title: '多模型設定', description: '透過環境變數設定多個相容 OpenAI 圖片介面的模型供應商。' },
    { title: '資料庫暫存', description: '圖片結果按 JOB_RESULT_TTL_MINUTES 暫時保留，降低資料庫長期占用。' },
    { title: '本機歷史', description: '瀏覽器 IndexedDB 保存圖片和參數，資料庫清理後仍可本機查看。' },
    { title: '驗證碼保護', description: 'Turnstile 和 hCaptcha 彈窗驗證，失敗原因更清楚。' },
    { title: '品質與比例', description: '快捷選擇 1K、2K、4K 和常用比例，適配不同模型能力。' },
  ],
  compareTitle: 'Aivro 與普通暫時生成頁',
  compareFeature: '能力',
  compareOther: '普通生成頁',
  compareRows: [
    { feature: '佇列狀態', aivro: '顯示位置和並發狀態', other: '通常只顯示等待中' },
    { feature: '圖片保存', aivro: '資料庫暫存，本機歷史長期保存', other: '重新整理後容易遺失' },
    { feature: '模型設定', aivro: '環境變數多供應商', other: '多為固定模型' },
    { feature: '驗證碼', aivro: '彈窗驗證和細分錯誤', other: '失敗原因不明確' },
    { feature: '參數選擇', aivro: '品質和比例快捷切換', other: '參數有限或隱藏' },
  ],
  faqTitle: '常見問題',
  faq: [
    { question: '資料庫裡的圖片會保存多久？', answer: '由 JOB_RESULT_TTL_MINUTES 控制，預設 15 分鐘。過期任務會在提交、輪詢或推進佇列時被清理。' },
    { question: '本機歷史會自動刪除嗎？', answer: '不會。本機歷史保存在你的瀏覽器 IndexedDB 中，直到你刪除單條歷史、清空歷史或清除瀏覽器站點資料。' },
    { question: '為什麼某些品質或比例會生成失敗？', answer: '不同 OpenAI-compatible provider 支援的尺寸不完全一致。失敗時可以切換到 1K 或更常見的 1:1 比例。' },
    { question: '完成驗證碼後仍失敗怎麼辦？', answer: '新版會區分未完成驗證、密鑰缺失、驗證服務不可達和驗證未通過。生產環境還需要確保站點密鑰綁定了正確網域。' },
  ],
  footer: '佇列圖片生成 · 本機歷史快取',
};

const ja: LocaleCopy = {
  ...enUS,
  subtitle:
    'プロンプトを入力し、モデル、品質、比率を選んで、共有キューで画像を生成します。結果は一時的にデータベースに保存され、削除するまでブラウザ履歴にも保存されます。',
  freeGenerate: '無料画像生成',
  heroTagline: 'プロンプトを入力し、共有キューで送信して、画像が生まれる瞬間を見届けましょう。',
  promptBarPlaceholder: '生成したい画像を説明してください...',
  generatingTitle: '画像を生成しています',
  generatingHint: 'モデルがプロンプトを描いています。通常は数秒で完了します。',
  queueWaitingTitle: 'キューで待機中',
  queueRankText: '現在の順位：{rank} 番目',
  startingTitle: 'リクエストを準備しています',
  navMenu: 'メニュー',
  promptLabel: 'プロンプト',
  promptPlaceholder: '生成したい画像を説明してください。例：雨の夜の未来都市、ガラスの高層ビルに反射するネオン、映画的な構図。',
  modelLabel: 'モデル',
  qualityLabel: '品質',
  aspectRatioLabel: '比率',
  priorityLabel: '優先キューを使う',
  priorityHint: '本日の残り {count} 回。優先ジョブは保護された実行枠の後に入ります。',
  submit: '画像を生成',
  submitting: '送信中...',
  confirmGenerate: '生成を確定',
  cancel: 'キャンセル',
  close: '閉じる',
  queueTitle: 'キュー状態',
  idleTitle: '送信待ち',
  idleDescription: '送信後、キュー位置、実行中の数、データベース保存の残り時間、結果が表示されます。',
  statusQueued: 'キュー中',
  statusRunning: '生成中',
  statusSucceeded: '完了',
  statusFailed: '失敗',
  statusExpired: 'タイムアウト',
  queuePosition: 'キュー位置',
  runningCount: '実行中',
  waitingCount: '待機中',
  ttlNotice: 'データベース上の結果は {time} 後に自動削除されます。ローカル履歴には影響しません。',
  download: 'ダウンロード',
  copyUrl: 'URLをコピー',
  copied: 'コピー済み',
  again: 'もう一度生成',
  resultAlt: '生成結果',
  queueFull: 'キューが混み合っています。後でもう一度お試しください。',
  captchaFailed: '人間確認に失敗しました。もう一度お試しください。',
  captchaMissing: '先に人間確認を完了してください。',
  captchaSecretMissing: 'Captcha サービスの設定が不完全です。サイト管理者に連絡してください。',
  captchaUnreachable: 'Captcha サービスを一時的に利用できません。後でもう一度お試しください。',
  captchaInvalid: '人間確認に通りませんでした。もう一度確認してください。',
  priorityLimit: '本日の優先キュー回数を使い切りました。',
  modelMissing: '利用可能なモデルを選択してください。',
  invalidPrompt: '有効なプロンプトを入力してください。',
  invalidImageOptions: '有効な品質と比率を選択してください。',
  databaseUnavailable: 'サービスを一時的に利用できません。後でもう一度お試しください。',
  providerFailed: '生成に失敗しました。一部のモデルは選択した品質や比率に対応していない場合があります。',
  jobExpired: 'タスクまたは画像の期限が切れました。もう一度生成してください。',
  captchaTitle: '人間確認を完了',
  captchaDescription: '確認が完了すると、生成タスクがすぐに送信されます。Captcha token はこのリクエストでのみ使用されます。',
  historyTitle: 'ブラウザのローカル履歴',
  historyDescription: '生成に成功した画像と設定はブラウザの IndexedDB に保存され、データベースの 15 分保存期限の影響を受けません。',
  historyUnavailable: 'このブラウザではローカル履歴を読み取れません。',
  historySaveFailed: '画像は生成されましたが、ローカル履歴に保存できませんでした。リモート画像がブラウザからの読み取りを制限している可能性があります。',
  historyEmpty: 'ローカル履歴はまだありません。生成に成功すると自動的にここに表示されます。',
  historyImageAlt: '履歴画像',
  historyClearConfirm: 'ローカル履歴をすべて削除しますか？この操作は元に戻せません。',
  preview: 'プレビュー',
  reuse: '再利用',
  delete: '削除',
  clearHistory: '履歴を消去',
  expandHistory: 'すべて表示',
  collapseHistory: '折りたたむ',
  featuresTitle: '公開無料生成キュー向けに設計',
  features: [
    { title: '透明なキュー', description: '送信後にキュー位置、待機数、実行中の生成数を表示します。' },
    { title: '複数モデル', description: '環境変数で複数の OpenAI 互換画像プロバイダーを設定できます。' },
    { title: '一時的なDB保存', description: 'JOB_RESULT_TTL_MINUTES に従って画像結果を一時保存し、DB使用量を抑えます。' },
    { title: 'ローカル履歴', description: 'IndexedDB が画像と設定を保存し、DB清理後もローカルで確認できます。' },
    { title: 'Captcha 保護', description: 'Turnstile と hCaptcha をモーダルで実行し、失敗理由を分かりやすく表示します。' },
    { title: '品質と比率', description: '1K、2K、4K と一般的な比率をすばやく選択できます。' },
  ],
  compareTitle: 'Aivro と一般的な一時生成ページ',
  compareFeature: '機能',
  compareOther: '一般的な生成ページ',
  compareRows: [
    { feature: 'キュー状態', aivro: '位置と同時実行状態を表示', other: '待機中だけの場合が多い' },
    { feature: '画像保存', aivro: 'DB一時保存とローカル履歴', other: '更新後に失われやすい' },
    { feature: 'モデル設定', aivro: '環境変数で複数プロバイダー', other: '固定モデルが多い' },
    { feature: 'Captcha', aivro: 'モーダル確認と詳細エラー', other: '失敗理由が不明確' },
    { feature: '生成設定', aivro: '品質と比率をすばやく切替', other: '設定が少ないか隠れている' },
  ],
  faqTitle: 'よくある質問',
  faq: [
    { question: 'データベース内の画像はどれくらい保存されますか？', answer: 'JOB_RESULT_TTL_MINUTES で制御され、既定は 15 分です。期限切れのジョブは送信、ポーリング、キュー進行時に清理されます。' },
    { question: 'ローカル履歴は自動削除されますか？', answer: 'いいえ。ローカル履歴はブラウザの IndexedDB に保存され、個別削除、全削除、またはサイトデータ削除まで残ります。' },
    { question: '品質や比率によって失敗するのはなぜですか？', answer: 'OpenAI-compatible provider ごとに対応サイズが異なります。失敗した場合は 1K または一般的な 1:1 比率を試してください。' },
    { question: 'Captcha 完了後も失敗する場合は？', answer: '新しいフローでは token 不足、secret 不足、検証サービス不可達、検証失敗を区別します。本番ではサイトキーが正しいドメインに紐づいていることも確認してください。' },
  ],
  footer: 'キュー画像生成 · ローカル履歴キャッシュ',
};

export const COPY: Record<SiteLocale, LocaleCopy> = {
  'en-US': enUS,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja,
};

export function isSiteLocale(locale: string): locale is SiteLocale {
  return LOCALES.includes(locale as SiteLocale);
}

export function localeFromPathname(pathname: string | null | undefined): SiteLocale {
  const segment = pathname?.split('/').filter(Boolean)[0] || '';
  return isSiteLocale(segment) ? segment : DEFAULT_LOCALE;
}

export function relativeLocalePath(locale: SiteLocale): string {
  return `/${locale}`;
}

export function absoluteLocaleUrl(locale: SiteLocale): string {
  return `${SITE_URL}${relativeLocalePath(locale)}`;
}

export function relativeLanguageAlternates() {
  return {
    ...Object.fromEntries(LOCALES.map((locale) => [locale, relativeLocalePath(locale)])),
    'x-default': '/',
  } as Record<SiteLocale | 'x-default', string>;
}

export function t(locale: SiteLocale, key: keyof LocaleCopy) {
  return COPY[locale][key];
}
