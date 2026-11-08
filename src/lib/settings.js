/**
 * 应用内配置：模型接入参数全部存在浏览器本地，改完立刻生效。
 *
 * 为什么不做成「部署时配环境变量」：
 * 本项目的发布形态就是扔几个静态文件上去，没有运维、没有后端进程。
 * 要让老师在 EdgeOne 控制台填 DEEPSEEK_API_KEY、再重新部署一次才能用，
 * 等于把「用一下 AI 评阅」拆成两个人的活，中间还会卡在没人告诉他要这么做。
 * 所以配置面板直接做进页面：填 Key → 保存 → 评阅按钮立刻可用。
 *
 * 必须如实交代代价：Key 明文存在本机 localStorage。
 * 同一浏览器、同一用户配置文件下的脚本能读到它。这不是加密存储，
 * 界面里也照实写，不假装安全。公用电脑上用完请点「清除」。
 */

export const SETTINGS_KEY = 'wenmai.settings.v1'
/** 旧版 Mock 开关，保留兼容：已存在的演示脚本仍在用这个键 */
export const LEGACY_MOCK_KEY = 'wenmai.review.mock'

export const DEFAULT_SETTINGS = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  /** 模型是否支持图片输入。DeepSeek 的 chat 模型不支持，默认关 */
  vision: false,
  /** 示例模式：不请求任何接口，用确定性假数据跑通界面 */
  mock: false,
  /** 直连被浏览器/网关拦住时，允许回退到站内云函数中继 */
  relay: true,
  updatedAt: ''
}

/** 去掉尾部斜杠、补协议，避免用户把 `api.deepseek.com` 直接粘进来 */
export function normalizeBaseUrl(input) {
  let s = String(input || '').trim()
  if (!s) return DEFAULT_SETTINGS.baseUrl
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  return s.replace(/\/+$/, '')
}

/** 常见供应商的展示名，纯装饰，不参与逻辑 */
export function providerLabel(baseUrl) {
  const u = normalizeBaseUrl(baseUrl).toLowerCase()
  if (u.includes('api.deepseek.com')) return 'DeepSeek'
  if (u.includes('dashscope.aliyuncs.com')) return '阿里云百炼'
  if (u.includes('open.bigmodel.cn')) return '智谱'
  if (u.includes('moonshot.cn')) return '月之暗面'
  if (u.includes('openai.com')) return 'OpenAI'
  if (u.includes('siliconflow.cn')) return '硅基流动'
  return '自定义（OpenAI 兼容）'
}

function normalizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) }
  return {
    apiKey: String(s.apiKey || '').trim(),
    baseUrl: normalizeBaseUrl(s.baseUrl),
    model: String(s.model || '').trim() || DEFAULT_SETTINGS.model,
    vision: Boolean(s.vision),
    mock: Boolean(s.mock),
    relay: s.relay !== false,
    updatedAt: String(s.updatedAt || '')
  }
}

export function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/* ---------------- 变更广播：同页多组件 + 跨标签页 ---------------- */

const listeners = new Set()
let cache = null

function emit(next) {
  cache = next
  listeners.forEach((fn) => {
    try {
      fn(next)
    } catch {
      /* 单个订阅者抛错不能影响其它订阅者 */
    }
  })
}

export function writeSettings(patch) {
  const next = normalizeSettings({
    ...readSettings(),
    ...(patch || {}),
    updatedAt: new Date().toISOString()
  })
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch {
    /* 隐私模式下写不进去：仍然让本次会话生效 */
  }
  emit(next)
  return next
}

export function resetSettings() {
  try {
    localStorage.removeItem(SETTINGS_KEY)
    localStorage.removeItem(LEGACY_MOCK_KEY)
  } catch {
    /* ignore */
  }
  emit({ ...DEFAULT_SETTINGS })
  return { ...DEFAULT_SETTINGS }
}

/** @returns {() => void} 取消订阅 */
export function subscribeSettings(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/* ---------------- 打开设置面板的请求 ---------------- */
/*
 * 设置面板挂在 Layout 上（全站唯一实例），但「去设置」按钮散落在
 * 评阅面板、错误提示等处。与其把这层弹窗状态塞进 Context 再层层传 props，
 * 不如让它变成一个可广播的意图：谁想打开就喊一声，Layout 负责开。
 */
const openListeners = new Set()

export function requestOpenSettings() {
  openListeners.forEach((fn) => {
    try {
      fn()
    } catch {
      /* 单个订阅者出错不影响其它 */
    }
  })
}

export function onOpenSettingsRequest(fn) {
  openListeners.add(fn)
  return () => openListeners.delete(fn)
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== SETTINGS_KEY) return
    emit(readSettings())
  })
}

/* ---------------- 展示辅助 ---------------- */

/** 是否具备真正请求模型的条件（示例模式不需要 Key，也算「可用」） */
export function isConfigured(s = readSettings()) {
  if (s.mock || s.apiKey) return true
  // 兼容旧版 Mock 开关：已有的演示脚本与测试仍用 `wenmai.review.mock` 打开示例模式
  try {
    return localStorage.getItem(LEGACY_MOCK_KEY) === '1'
  } catch {
    return false
  }
}

/** 是否已经能真正调模型（不含示例模式） */
export function hasRealKey(s = readSettings()) {
  return Boolean(String(s.apiKey || '').trim())
}

/** 密钥脱敏：只留前 4 后 4，够确认「填的是哪一把」 */
export function maskKey(key) {
  const k = String(key || '')
  if (!k) return ''
  if (k.length <= 10) return `${k.slice(0, 2)}${'*'.repeat(Math.max(2, k.length - 2))}`
  return `${k.slice(0, 4)}${'*'.repeat(Math.min(12, k.length - 8))}${k.slice(-4)}`
}

/** 粗略校验：主流厂商的 Key 都是 20 位以上的无空格串 */
export function looksLikeKey(key) {
  const k = String(key || '').trim()
  if (!k) return { ok: false, hint: '还没填密钥' }
  if (/\s/.test(k)) return { ok: false, hint: '密钥里不应有空格或换行' }
  if (k.length < 16) return { ok: false, hint: '长度偏短，请确认是否复制完整' }
  return { ok: true, hint: '' }
}
