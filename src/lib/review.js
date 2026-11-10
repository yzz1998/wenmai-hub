/**
 * AI 评阅前端客户端。
 *
 * 三条通道，按优先级：
 *
 * 1) **直连模型**（默认）。用设置面板里填的 Key，直接从浏览器请求
 *    `{baseUrl}/chat/completions`。DeepSeek 与主流 OpenAI 兼容端点都回显
 *    `Access-Control-Allow-Origin`，所以静态站也能跑，不需要任何云端配置。
 *
 * 2) **站内中继**（可选回退）。直连被浏览器扩展、企业网关或 CORS 策略挡住时，
 *    改走同域的 `/api/review`，把 Key 放在 `x-api-key` 头里带过去 —— 云函数
 *    自己不持有密钥，只做转发。用户在设置里可以关掉这条路。
 *
 * 3) **示例模式**。不请求任何接口，按文本长度生成确定性假数据，
 *    用来跑通界面与自动化测试，避免在没有 Key 的机器上什么都点不动。
 *
 * 错误码 → 文案这张表仍然集中在这里：组件只渲染不判断，
 * 否则同一句错误会在三个页面里各写一遍、还写得不一样。
 */

import {
  resolveRubricKey,
  getRubric,
  buildMessages,
  maxTokensFor,
  normalizeReview,
  extractJson,
  levelOf as rubricLevelOf
} from './review-core'
import { readSettings } from './settings'

const RELAY_URL = import.meta.env.VITE_REVIEW_API || '/api/review'

/**
 * 超时预算。为什么要 150 秒而不是 95 秒：
 * 实测一份 3700 字教案 + 七维量表，deepseek-flash 在 effort=high 下用时约 25 秒，
 * 思维链占 3293 token；三万字长文时思维链会更长。95 秒对于「长文 + 推理模型」是紧的，
 * 一旦超时用户拿到的是失败页，而不是「再等等」。
 */
const DIRECT_TIMEOUT_MS = 150000
/** 降级重试（压缩文本 + 低推理强度）用更短超时：此时文本已压到 12000 字，不该再等 150 秒 */
const RETRY_TIMEOUT_MS = 110000
const RELAY_TIMEOUT_MS = 120000

/**
 * 降级重试时把正文压到多长。
 * 不是简单截断：表格行与短标题优先保留，长段落均分剩余预算各取开头。
 * 教案/调查报告的关键信息大量在表格里，一刀切砍后半段会把「教学过程表」整块丢掉。
 */
const CONDENSE_CHARS = 12000

export class ReviewError extends Error {
  constructor(code, { message, retryable = false, retryAfterMs = 0, cause = null } = {}) {
    super(message || code)
    this.name = 'ReviewError'
    this.code = code
    this.retryable = retryable
    this.retryAfterMs = retryAfterMs
    this.cause = cause
  }
}

/**
 * `retry` 为 false 的项刻意不给重试按钮：没填密钥、余额不足、格式不支持这类，
 * 点十次也不会好，给按钮只会让人怀疑系统坏了。
 * `action` 可选值：'settings'（引导去设置面板）/ 'content'（引导补内容）。
 */
export const REVIEW_ERROR_COPY = {
  NETWORK: {
    title: '连不上模型服务',
    desc: '网络不通，或浏览器拦下了这次跨域请求。可检查网络后重试；若一直失败，到「AI 设置」里把「允许站内中继」打开。',
    retry: true
  },
  DIRECT_BLOCKED: {
    title: '浏览器拦截了直连请求',
    desc: '当前网络或插件不允许页面直接访问模型接口。请到「AI 设置」里开启「允许站内中继」后重试。',
    retry: true,
    action: 'settings'
  },
  NO_API_KEY: {
    title: '还没填模型密钥',
    desc: '点右上角「AI 设置」填入 DeepSeek（或其它兼容厂商）的 API Key，保存后立即可用，不需要改代码或重新部署。',
    retry: false,
    action: 'settings'
  },
  INVALID_KEY: {
    title: '模型密钥无效或已过期',
    desc: '请到「AI 设置」里核对 Key 是否复制完整、是否已被撤销。',
    retry: false,
    action: 'settings'
  },
  INSUFFICIENT_BALANCE: {
    title: '模型账户余额不足',
    desc: '这次请求被厂商拒绝，需要充值或换一把可用的 Key。',
    retry: false,
    action: 'settings'
  },
  RATE_LIMITED: {
    title: '请求过于频繁',
    desc: '模型服务正在限流，稍等片刻再试即可。',
    retry: true
  },
  UPSTREAM_TIMEOUT: {
    title: '模型响应超时',
    desc: '已自动压缩正文并降低推理强度重试过一次，仍未在时限内返回。可稍后再试；持续超时建议把正文精简到 1 万字内。',
    retry: true
  },
  OUTPUT_TRUNCATED: {
    title: '模型输出被截断',
    desc: '模型的思维链占满了输出预算，正文没写完就被截停。系统已自动加大预算重试过，仍失败时再点一次即可。',
    retry: true
  },
  UPSTREAM_ERROR: {
    title: '模型服务暂时不可用',
    desc: '上游返回了错误，通常是服务波动，或该模型不支持本次请求的参数。稍后再试；若持续出现，在设置里换一个模型名。',
    retry: true
  },
  BAD_OUTPUT: {
    title: '模型返回格式异常',
    desc: '没能从模型回复里解析出约定的 JSON 结构。可直接重试；若持续出现，换一个更稳的模型。',
    retry: true
  },
  TEXT_TOO_SHORT: {
    title: '正文太短，无法评阅',
    desc: '有效正文不足 200 字。请补充内容，或上传完整的文档后再评。',
    retry: false,
    action: 'content'
  },
  PAYLOAD_TOO_LARGE: {
    title: '正文超出可评阅长度',
    desc: '单次最多评阅 3 万字，提交前会自动截断。看到这条说明请求绕过了截断逻辑，刷新页面重新评阅即可。',
    retry: false
  },
  NO_TEXT: {
    title: '还没有可评阅的正文',
    desc: '这份成果没有正文，也没有可解析的文档。请先在编辑页补充正文或上传文档。',
    retry: false,
    action: 'content'
  },
  ABORTED: {
    title: '已取消评阅',
    desc: '你在评阅完成前离开了，结果未保存。',
    retry: true
  },
  INTERNAL: {
    title: '评阅过程出错',
    desc: '出现了未预期的问题，可重试一次；若持续出现，把上面的技术信息发给我。',
    retry: true
  }
}

export function reviewErrorText(code) {
  return REVIEW_ERROR_COPY[code] || REVIEW_ERROR_COPY.INTERNAL
}

/* ------------------------------------------------------------------ */
/* 量表（真源在 cloud-functions/_lib/rubrics/）                          */
/* ------------------------------------------------------------------ */

/** 某套量表的维度（展示用：key/name/max/block） */
export function dimensionsOf(rubricKey) {
  return getRubric(rubricKey).dimensions.map(({ key, name, max, block }) => ({ key, name, max, block }))
}

/** 兼容导出：通用量表的四维。新代码请用 dimensionsOf(rubricKey) */
export const DIMENSIONS = dimensionsOf('paper')

/** 量表元信息列表，用于下拉/说明文案 */
export const RUBRIC_OPTIONS = ['paper', 'lesson'].map((k) => {
  const r = getRubric(k)
  return {
    key: r.key,
    name: r.name,
    shortName: r.shortName,
    total: r.total,
    dimsHint: r.dimsHint,
    dimensionCount: r.dimensions.length,
    appliesTo: r.appliesTo
  }
})

/** 这份成果会用哪套量表 */
export function rubricFor(work) {
  return getRubric(resolveRubricKey({ work }))
}

/**
 * 按 key 取量表对象（整份定义，含 systemPrompt）。
 *
 * 存在的理由：界面上有两件事需要区分——
 *   「这份成果现在**如果**重评会用哪套标准」（`rubricFor(work)`）
 *   与「屏幕上这份**已有结果**当时是按哪套标准评的」（`rubricForKey(review.rubricKey)`）。
 * 两者在「评阅之后又改了成果类型」时会不一致，混用会让表头写着「7 维」而下面列着 4 行。
 */
export function rubricForKey(key) {
  return getRubric(key)
}

export const levelOf = rubricLevelOf

/** 总评分级（按百分制），与单维的四等级分开算 */
export const gradeOf = (total) => {
  if (total >= 85) return '优秀'
  if (total >= 70) return '良好'
  if (total >= 60) return '合格'
  return '待改进'
}

/* ------------------------------------------------------------------ */
/* 人工修订                                                            */
/* ------------------------------------------------------------------ */
/**
 * AI 结果允许人工修订，但修订必须是**受约束的编辑**，不能变成「随便填一个分」：
 *
 * 1) 分数一律钳到 0–该维满分并取整，等级由分数重算 —— 界面上永远不可能出现
 *    「72 分但标优秀」这种自相矛盾的组合。
 * 2) 总分一律由分项相加，不接受手工填总分。改了某一维，总分立刻跟着动。
 * 3) 第一次修订前把 AI 原始结果整份存进 `origin`，用户随时可以一键恢复；
 *    报告里也能标出哪些维度被改过（✎）。
 *
 * 4) 长度上限比 AI 那套（评语 60 / 证据 40）宽得多：人工写评语不该被 60 字卡住。
 *    但仍设硬顶，因为整份评阅结果存在 localStorage 里，超长会静默写失败。
 */
export const EDIT_LIMITS = { comment: 300, evidence: 200, summary: 800, item: 120 }

const clampScore = (v, max) => {
  const raw = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(raw)) return 0
  return Math.max(0, Math.min(max, Math.round(raw)))
}

/** 人工输入保留换行与原有标点，只压掉多余空白；不做 AI 那套「退到句读截断」 */
const softTrim = (v, max) => {
  const s = String(v ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return s.length > max ? s.slice(0, max) : s
}

const cleanList = (list) =>
  (Array.isArray(list) ? list : [])
    .map((s) => softTrim(s, EDIT_LIMITS.item))
    .filter(Boolean)

/** AI 原始结果的快照（不含 origin 自身，避免无限嵌套） */
function snapshotOf(review) {
  return {
    total: review.total,
    dimensions: (review.dimensions || []).map((d) => ({ ...d })),
    highlights: [...(review.highlights || [])],
    summary: review.summary || '',
    suggestions: [...(review.suggestions || [])],
    at: review.createdAt || null
  }
}

/** 把已有结果转成可编辑草稿：分数转成字符串，输入框才能「清空后重填」而不跳成 0 */
export function editableDraft(review) {
  if (!review) return null
  return {
    dimensions: (review.dimensions || []).map((d) => ({
      key: d.key,
      name: d.name,
      max: d.max || 25,
      block: d.block || '',
      score: String(d.score ?? ''),
      comment: d.comment || '',
      evidence: d.evidence || ''
    })),
    highlights: [...(review.highlights || [])],
    summary: review.summary || '',
    suggestions: [...(review.suggestions || [])]
  }
}

/** 草稿的总分（编辑时实时预览用），与保存后的算法完全一致 */
export function draftTotal(draft) {
  return (draft?.dimensions || []).reduce((s, d) => s + clampScore(d.score, d.max || 25), 0)
}

/** 草稿某一维的等级（随输入实时变化） */
export function draftLevel(d) {
  return levelOf(clampScore(d?.score, d?.max || 25), d?.max || 25)
}

/** 相对 AI 原始结果被改过的维度 key，报告里用来打 ✎ */
export function editedDimensionKeys(review) {
  if (!review?.origin?.dimensions) return []
  const byKey = new Map(review.origin.dimensions.map((d) => [d.key, d]))
  return (review.dimensions || [])
    .filter((d) => {
      const o = byKey.get(d.key)
      return !o || o.score !== d.score || o.comment !== d.comment || o.evidence !== d.evidence
    })
    .map((d) => d.key)
}

/**
 * 把草稿合并回评阅结果。
 *
 * @param {object} review 当前结果
 * @param {object} draft  editableDraft() 的形状（分数可以是字符串）
 * @returns {object} 新结果：分数钳位、等级重算、总分求和、origin 快照、修订元信息
 */
export function applyReviewEdits(review, draft) {
  if (!review || !draft) return review
  const prev = new Map((review.dimensions || []).map((d) => [d.key, d]))

  const dimensions = (draft.dimensions || []).map((d) => {
    const base = prev.get(d.key) || {}
    const max = base.max || d.max || 25
    const score = clampScore(d.score, max)
    return {
      key: base.key || d.key,
      name: base.name || d.name,
      max,
      score,
      level: levelOf(score, max),
      block: base.block || d.block || '',
      comment: softTrim(d.comment, EDIT_LIMITS.comment),
      evidence: softTrim(d.evidence, EDIT_LIMITS.evidence)
    }
  })

  const total = dimensions.reduce((s, d) => s + d.score, 0)
  const highlights = cleanList(draft.highlights)
  const suggestions = cleanList(draft.suggestions)
  const summary = softTrim(draft.summary, EDIT_LIMITS.summary)

  // 以「首次 AI 结果」为基准判断是否真的改过；改回原样就等于没改
  const origin = review.origin || snapshotOf(review)
  const next = { ...review, total, dimensions, highlights, summary, suggestions }
  const untouched =
    !editedDimensionKeys({ ...next, origin }).length &&
    JSON.stringify(highlights) === JSON.stringify(origin.highlights || []) &&
    JSON.stringify(suggestions) === JSON.stringify(origin.suggestions || []) &&
    summary === (origin.summary || '') &&
    total === origin.total

  if (untouched) {
    // 全部改回去了：不留下「已修订」的痕迹，也不该再提供「恢复原结果」按钮
    return { ...next, edited: false, origin: null, editedAt: null, editCount: 0 }
  }

  return {
    ...next,
    origin,
    edited: true,
    editedAt: new Date().toISOString(),
    editCount: (review.editCount || 0) + 1
  }
}

/** 一键恢复 AI 原始结果（保留评阅来源信息与量表元数据） */
export function restoreOriginalReview(review) {
  const o = review?.origin
  if (!o) return review
  return {
    ...review,
    total: o.total,
    dimensions: (o.dimensions || []).map((d) => ({ ...d })),
    highlights: [...(o.highlights || [])],
    summary: o.summary || '',
    suggestions: [...(o.suggestions || [])],
    edited: false,
    origin: null,
    editedAt: null,
    restoredAt: new Date().toISOString()
  }
}

export function isMockMode(s = readSettings()) {
  if (s?.mock) return true
  try {
    if (import.meta.env.VITE_REVIEW_MOCK === '1') return true
    return localStorage.getItem('wenmai.review.mock') === '1'
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* 文本压缩（超时降级用）                                                */
/* ------------------------------------------------------------------ */

/**
 * 按「结构优先」压缩正文。
 *
 * 为什么不用 slice(0, N)：教案、调查报告的关键信息大量集中在表格行与标题里，
 * 直接砍掉后半段会把「教学过程」「评价方式」整块丢掉，评出来的分数比评不了还糟。
 * 这里的做法是把含「 | 」的表格行与短标题视为骨架，先全额保留；
 * 剩余预算平均分给长段落，各取开头，并留省略号提示已被裁剪。
 *
 * @returns {{text: string, condensed: boolean, originalChars: number}}
 */
export function condenseText(text, limit = CONDENSE_CHARS) {
  const s = String(text || '')
  if (s.length <= limit) return { text: s, condensed: false, originalChars: s.length }

  const lines = s.split('\n')
  const isSkeleton = (l) => l.includes(' | ') || l.trim().length <= 40
  const skeleton = []
  const body = []
  lines.forEach((l, i) => (isSkeleton(l) ? skeleton : body).push(i))

  const out = new Array(lines.length).fill('')
  let budget = limit

  for (const i of skeleton) {
    const l = lines[i]
    if (budget - l.length - 1 < 0) continue
    out[i] = l
    budget -= l.length + 1
  }

  if (body.length && budget > 0) {
    const per = Math.max(80, Math.floor(budget / body.length))
    for (const i of body) {
      const l = lines[i]
      out[i] = l.length > per ? `${l.slice(0, per)}…` : l
    }
  }

  return {
    text: out.filter(Boolean).join('\n').slice(0, limit),
    condensed: true,
    originalChars: s.length
  }
}

/* ------------------------------------------------------------------ */
/* Mock：确定性结果，便于断言与离线演示                                  */
/* ------------------------------------------------------------------ */

function mockReview({ work, bundle, rubricKey }) {
  const rubric = getRubric(rubricKey)
  const n = String(bundle?.text || '').length
  const seed = n % 17
  const dimensions = rubric.dimensions.map((d, i) => {
    const ratio = 0.76 + ((seed + i * 3) % 5) * 0.035
    const score = Math.max(0, Math.min(d.max, Math.round(d.max * ratio)))
    return {
      key: d.key,
      name: d.name,
      score,
      max: d.max,
      block: d.block || '',
      level: levelOf(score, d.max),
      comment: '（示例模式）该维度评语示例，用于验证界面与数据链路。',
      evidence: '（无对应文本）'
    }
  })
  const materials = bundle?.materials || {}
  return {
    workId: work?.id || '',
    total: dimensions.reduce((s, d) => s + d.score, 0),
    dimensions,
    highlights: rubric.key === 'lesson' ? ['（示例）环节时长与标注课时基本对得上'] : [],
    summary: `（示例模式）《${work?.title || '成果'}》的评阅结果在本地生成，未请求任何模型。它只用于验证界面与流程，不代表真实判断；在「AI 设置」里填入密钥后即为真实评阅。`,
    suggestions: [
      '为关键判断补上可核查的来源',
      '把结论改写成可验证的具体表述',
      '统一文中术语与标点格式',
      '补齐每个环节的学生活动与产出'
    ].slice(0, 4),
    rubric: rubric.version,
    rubricKey: rubric.key,
    rubricName: rubric.name,
    promptVersion: 'mock',
    model: 'mock-deterministic',
    source: 'mock',
    inputChars: n,
    truncated: Boolean(bundle?.truncated),
    materialsBrief: materials.docs || materials.images || materials.skipped
      ? {
          docs: (materials.docs || []).length,
          images: (materials.images || []).length,
          skipped: (materials.skipped || []).length
        }
      : null,
    createdAt: new Date().toISOString()
  }
}

/* ------------------------------------------------------------------ */
/* 通道 A：浏览器直连模型                                               */
/* ------------------------------------------------------------------ */

/** 把图片挂到最后一条 user 消息上（OpenAI 兼容的多模态 content 数组） */
function withVision(messages, parts) {
  if (!parts?.length) return messages
  return messages.map((m, i) => {
    if (i !== messages.length - 1 || m.role !== 'user') return m
    return {
      role: 'user',
      content: [
        { type: 'text', text: m.content },
        ...parts.map((p) => ({ type: 'image_url', image_url: { url: p.dataUrl } }))
      ]
    }
  })
}

function retryAfterMs(res) {
  const v = Number(res.headers.get('retry-after'))
  return Number.isFinite(v) && v > 0 ? v * 1000 : 0
}

async function readErrorBody(res) {
  try {
    const text = await res.text()
    try {
      return JSON.parse(text)?.error?.message || text.slice(0, 200)
    } catch {
      return text.slice(0, 200)
    }
  } catch {
    return ''
  }
}

/**
 * @param {{settings, messages, visionParts, maxTokens, timeoutMs, effort, jsonMode}} args
 */
async function callDirect({
  settings,
  messages,
  visionParts,
  maxTokens,
  timeoutMs = DIRECT_TIMEOUT_MS,
  effort = '',
  jsonMode = true
}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const body = {
    model: settings.model,
    messages: withVision(messages, visionParts),
    temperature: 0.2,
    max_tokens: maxTokens,
    stream: false
  }
  if (jsonMode) body.response_format = { type: 'json_object' }
  if (effort) body.reasoning_effort = effort

  let res
  try {
    res = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new ReviewError('UPSTREAM_TIMEOUT', { message: `直连 ${timeoutMs / 1000} 秒未返回`, retryable: true })
    }
    // fetch 在 CORS 被拒 / DNS 失败 / 断网时都抛 TypeError，且不告诉你是哪一种
    throw new ReviewError('DIRECT_BLOCKED', { message: e?.message || 'fetch failed', retryable: true, cause: e })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const detail = await readErrorBody(res)
    if (res.status === 401 || res.status === 403) {
      throw new ReviewError('INVALID_KEY', { message: detail || `HTTP ${res.status}`, retryable: false })
    }
    if (res.status === 402) {
      throw new ReviewError('INSUFFICIENT_BALANCE', { message: detail || '余额不足', retryable: false })
    }
    if (res.status === 429) {
      throw new ReviewError('RATE_LIMITED', {
        message: detail || '触发限流',
        retryable: true,
        retryAfterMs: retryAfterMs(res)
      })
    }
    // 有的兼容端点不认 response_format=json_object / reasoning_effort / 大 max_tokens，会回 400
    if (res.status === 400) {
      throw new ReviewError('BAD_PARAM', { message: detail || '参数被上游拒绝', retryable: true })
    }
    throw new ReviewError('UPSTREAM_ERROR', { message: detail || `HTTP ${res.status}`, retryable: res.status >= 500 })
  }

  let payload
  try {
    payload = await res.json()
  } catch {
    throw new ReviewError('BAD_OUTPUT', { message: '响应不是 JSON', retryable: true })
  }

  const choice = payload?.choices?.[0] || {}
  const content = choice.message?.content
  const reasoning = choice.message?.reasoning_content || ''
  const finishReason = choice.finish_reason || ''

  if (!content) {
    // 推理模型把输出预算全用在思维链上时，content 是空的、finish_reason 是 length。
    // 这不是「模型不会答」，而是预算不够 —— 必须单独成一个错误码，好让上层加大预算重试。
    if (finishReason === 'length') {
      throw new ReviewError('OUTPUT_TRUNCATED', {
        message: `输出预算耗尽（推理 ${payload?.usage?.completion_tokens_details?.reasoning_tokens ?? '较多'} token）`,
        retryable: true
      })
    }
    throw new ReviewError('BAD_OUTPUT', { message: '响应里没有 content', retryable: true })
  }

  return {
    raw: extractJson(content),
    content,
    model: payload?.model || settings.model,
    finishReason,
    reasoningChars: reasoning.length,
    usage: payload?.usage || null
  }
}

/* ------------------------------------------------------------------ */
/* 通道 B：站内云函数中继                                               */
/* ------------------------------------------------------------------ */

async function callRelay({ settings, bundle, work, rubricKey, maxTokens, effort }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS)
  let res
  try {
    res = await fetch(RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': settings.apiKey },
      /**
       * 刻意**不**把 settings.baseUrl 一起送过去。
       * 那样云函数就成了「你给什么地址我就往哪发」的开放代理，是白送的 SSRF 面。
       * 中继只连站点自己配置的端点；要用别的厂商，就走直连（那条路本来也不需要中继）。
       */
      body: JSON.stringify({
        schemaVersion: 2,
        rubric: rubricKey,
        text: bundle.text,
        truncated: Boolean(bundle.truncated),
        materials: bundle.materials || null,
        model: settings.model,
        maxTokens,
        effort: effort || '',
        work: {
          id: work?.id || '',
          title: work?.title || '',
          type: work?.type || '',
          grade: work?.grade || '',
          course: work?.course || '',
          summary: work?.summary || ''
        }
      }),
      signal: controller.signal
    })
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new ReviewError('UPSTREAM_TIMEOUT', { message: '中继超时', retryable: true })
    }
    throw new ReviewError('NETWORK', { message: e?.message || '网络错误', retryable: true })
  } finally {
    clearTimeout(timer)
  }

  // 路由没匹配上时平台会回 HTML，这里不能直接 .json()
  let payload = null
  try {
    payload = await res.json()
  } catch {
    throw new ReviewError('NETWORK', { message: `响应不是 JSON（HTTP ${res.status}）`, retryable: true })
  }

  if (!res.ok || !payload?.ok) {
    const err = payload?.error || {}
    throw new ReviewError(err.code || 'INTERNAL', {
      message: err.message || `HTTP ${res.status}`,
      retryable: Boolean(err.retryable),
      retryAfterMs: Number(err.retryAfterMs) || 0
    })
  }
  return { data: payload.data, model: payload.data?.model }
}

/* ------------------------------------------------------------------ */
/* 对外入口                                                             */
/* ------------------------------------------------------------------ */

/** 同一份成果并发点两次「重新评阅」时复用一个 Promise，避免重复计费 */
const inflight = new Map()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * 发起评阅。
 * @param {{work: object, bundle: {text, truncated, materials, visionParts}, settings?: object}} args
 * @returns {Promise<object>} ReviewResult
 */
export async function requestReview({ work, bundle, settings: override = null }) {
  const settings = override || readSettings()
  const text = String(bundle?.text || '').trim()
  if (!text) {
    throw new ReviewError('NO_TEXT', { message: '没有可评阅的正文', retryable: false })
  }

  // 量表由成果类型决定：同一份成果无论走直连还是中继，都必须是同一套维度
  const rubricKey = resolveRubricKey({ work })
  // 预算要跟着正文长度走：教案 7 维的正文段固定，推理段随字数增长（详见 maxTokensFor）
  const maxTokens = maxTokensFor(rubricKey, text.replace(/\s/g, '').length)

  if (isMockMode(settings)) {
    await sleep(900)
    return mockReview({ work, bundle, rubricKey })
  }

  if (!settings.apiKey) {
    throw new ReviewError('NO_API_KEY', { message: '未配置 API Key', retryable: false })
  }

  const key = work?.id || '__anon__'
  if (inflight.has(key)) return inflight.get(key)

  const visionParts = settings.vision ? bundle?.visionParts || [] : []
  const messages = buildMessages({ rubricKey, work, bundle })
  const startedAt = Date.now()

  const finish = (raw, meta) => {
    const result = normalizeReview(raw, {
      rubricKey,
      work,
      model: meta.model || settings.model,
      inputChars: meta.inputChars,
      truncated: Boolean(meta.truncated),
      latencyMs: Date.now() - startedAt
    })
    return {
      ...result,
      source: meta.source,
      finishReason: meta.finishReason || '',
      condensed: Boolean(meta.condensed),
      originalChars: Number(meta.originalChars) || result.inputChars,
      workId: work?.id || '',
      materialsBrief: bundle?.materials
        ? {
            docs: (bundle.materials.docs || []).length,
            images: (bundle.materials.images || []).length,
            skipped: (bundle.materials.skipped || []).length
          }
        : null
    }
  }

  const run = async () => {
    let out
    let viaRelay = false
    let condensed = false
    let usedChars = String(bundle.text || '').replace(/\s/g, '').length
    let usedTruncated = Boolean(bundle.truncated)
    let originalChars = usedChars

    try {
      out = await callDirect({ settings, messages, visionParts, maxTokens })
    } catch (e) {
      const code = e?.code

      /* 可恢复的「慢」：超时 / 输出被截断。
         策略是降级一次，而不是把失败甩给用户：
         压缩正文（保留表格与标题骨架）→ 降低推理强度 → 加大输出预算。
         实测 deepseek-flash 的 reasoning_effort 从 high 降到 low，思维链少约 40%。 */
      if (code === 'UPSTREAM_TIMEOUT' || code === 'OUTPUT_TRUNCATED') {
        const packed = condenseText(bundle.text)
        const retryBundle = { ...bundle, text: packed.text, truncated: true }
        const retryMessages = packed.condensed
          ? buildMessages({ rubricKey, work, bundle: retryBundle })
          : messages
        try {
          out = await callDirect({
            settings,
            messages: retryMessages,
            visionParts,
            maxTokens: Math.min(12000, Math.round(maxTokens * 1.5)),
            timeoutMs: RETRY_TIMEOUT_MS,
            effort: 'low'
          })
          condensed = packed.condensed
          usedChars = packed.text.replace(/\s/g, '').length
          usedTruncated = true
          if (packed.condensed) originalChars = packed.originalChars
        } catch (e2) {
          throw e2
        }
      } else if (code === 'DIRECT_BLOCKED' || code === 'BAD_PARAM' || code === 'BAD_OUTPUT') {
        if (!settings.relay) throw e
        // 直连被拦、或端点不认 json 模式时，退到站内中继再试一次
        out = { data: (await callRelay({ settings, bundle, work, rubricKey, maxTokens })).data }
        viaRelay = true
      } else {
        throw e
      }
    }

    if (viaRelay) {
      return { ...out.data, workId: work?.id || '', source: 'relay' }
    }

    // 模型偶尔会把 JSON 包在废话里；extractJson 兜不住时，用同一条消息再要一次
    if (!out.raw) {
      const retry = await callDirect({
        settings,
        messages: [
          ...messages,
          { role: 'assistant', content: String(out.content || '').slice(0, 2000) },
          {
            role: 'user',
            content:
              '你上一次的输出不是合法 json。请只输出一个 json 对象，不要 markdown 代码块、不要任何解释文字，dimensions 必须包含量表里的全部维度。'
          }
        ],
        visionParts: [],
        maxTokens: Math.min(12000, Math.round(maxTokens * 1.3)),
        effort: 'low'
      })
      out = retry
    }

    if (!out.raw?.dimensions) {
      throw new ReviewError('BAD_OUTPUT', { message: '模型未返回可解析的 JSON', retryable: true })
    }

    return finish(out.raw, {
      model: out.model,
      finishReason: out.finishReason,
      source: settings.baseUrl.includes('api.deepseek.com') ? 'deepseek' : 'openai-compatible',
      inputChars: usedChars,
      truncated: usedTruncated,
      condensed,
      originalChars
    })
  }

  const p = run().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

/**
 * 连通性自检：用最小代价发一条请求，确认 Key、Base URL、模型名三者都对。
 * 不评任何材料，只验证「这条路能走通」——这正是设置面板最需要回答的问题。
 */
export async function testConnection(settings) {
  if (!settings?.apiKey) {
    throw new ReviewError('NO_API_KEY', { message: '未填写 API Key', retryable: false })
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  const startedAt = Date.now()
  let res
  try {
    res = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'user', content: '只回复两个字符：OK' }],
        /**
         * 这里给 64 而不是 8：推理型模型（deepseek-flash）会先花 token 想，
         * 预算太小会导致 content 为空、finish_reason=length，
         * 于是「Key 明明是对的，自检却报格式异常」——这个坑真实发生过。
         */
        max_tokens: 64,
        temperature: 0
      }),
      signal: controller.signal
    })
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new ReviewError('UPSTREAM_TIMEOUT', { message: '自检超时（30 秒）', retryable: true })
    }
    throw new ReviewError('DIRECT_BLOCKED', { message: e?.message || 'fetch failed', retryable: true, cause: e })
  } finally {
    clearTimeout(timer)
  }

  const latencyMs = Date.now() - startedAt
  if (!res.ok) {
    const detail = await readErrorBody(res)
    const code =
      res.status === 401 || res.status === 403
        ? 'INVALID_KEY'
        : res.status === 402
          ? 'INSUFFICIENT_BALANCE'
          : res.status === 429
            ? 'RATE_LIMITED'
            : 'UPSTREAM_ERROR'
    const hint = res.status === 404 ? '（模型名可能写错了）' : ''
    throw new ReviewError(code, { message: `${detail || `HTTP ${res.status}`}${hint}`, retryable: false })
  }

  let payload
  try {
    payload = await res.json()
  } catch {
    throw new ReviewError('BAD_OUTPUT', { message: '响应不是 JSON', retryable: true })
  }
  return {
    ok: true,
    latencyMs,
    model: payload?.model || settings.model,
    reply: String(payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.message?.reasoning_content || '').slice(0, 40)
  }
}

/** 评阅报告（Markdown），详情页「导出报告」用 */
export function buildReviewMarkdown(review, work) {
  if (!review) return ''
  const mb = review.materialsBrief
  const editedKeys = new Set(editedDimensionKeys(review))
  const materialLine = mb
    ? `- 评阅材料：正文 ${(review.inputChars || 0).toLocaleString('zh-CN')} 字${mb.docs ? ` · 文档 ${mb.docs} 份` : ''}${mb.images ? ` · 配图 ${mb.images} 张` : ''}${mb.skipped ? ` · 未纳入 ${mb.skipped} 项` : ''}`
    : ''
  const lines = [
    `# ${work?.title || '成果'} · AI 评阅报告`,
    '',
    `- 成果编号：${work?.id || '—'}`,
    `- 作者：${work?.author || '—'}`,
    `- 类型：${work?.type || '—'} ｜ 学段：${work?.grade || '—'}`,
    `- 量表：${review.rubricName || '评阅量表'}（${review.rubric || '—'}）`,
    materialLine,
    `- 总分：${review.total} / 100（${gradeOf(review.total)}）`,
    `- 评阅模型：${review.model} ｜ 生成时间：${new Date(review.createdAt).toLocaleString('zh-CN')}`,
    ...(review.edited
      ? [
          `- 人工修订：是（第 ${review.editCount || 1} 次，${new Date(review.editedAt || review.createdAt).toLocaleString('zh-CN')}）；标 ✎ 的维度分数或评语已由教师手动调整`
        ]
      : []),
    ...(review.condensed
      ? [`- 注意：正文过长，本次评阅使用的是压缩后的 ${review.inputChars} 字版本（保留表格与标题）`]
      : review.truncated
        ? ['- 注意：正文超过 3 万字，仅评阅了前 3 万字']
        : []),
    '',
    '## 分项得分',
    '',
    '| 维度 | 得分 | 等级 | 评语 | 原文证据 |',
    '| --- | --- | --- | --- | --- |',
    ...review.dimensions.map(
      (d) =>
        `| ${d.name}${editedKeys.has(d.key) ? ' ✎' : ''} | ${d.score}/${d.max} | ${d.level} | ${(d.comment || '').replace(/\|/g, '／')} | ${(d.evidence || '').replace(/\|/g, '／')} |`
    ),
    '',
    ...((review.highlights || []).length
      ? ['## 亮点', '', ...review.highlights.map((h) => `- ${h}`), '']
      : []),
    '## 总评',
    '',
    review.summary || '',
    '',
    '## 改进建议',
    '',
    ...(review.suggestions || []).map((s, i) => `${i + 1}. ${s}`),
    '',
    '---',
    '',
    review.edited
      ? `> 本报告以 AI 依据《${review.rubricName || '评阅量表'}》生成的评阅为基础，其中标 ✎ 的维度已由教师人工修订，总分按修订后的分项重新求和。`
      : `> 本报告由 AI 依据《${review.rubricName || '评阅量表'}》自动生成，仅供教学参考。`,
    ''
  ]
  return lines.filter((l) => l !== undefined).join('\n')
}
