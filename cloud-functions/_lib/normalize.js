/**
 * 模型输出的校验与清洗。
 *
 * 这一段是整个链路里最该「不信任上游」的地方：模型返回的 score 可能是
 * 26、-3、"二十"、小数，dimensions 可能少一项或顺序打乱，suggestions 可能一条不给。
 * 全部在这里钳位、补齐、重算，绝不把半成品透给前端。
 *
 * 两条硬规则：
 * 1) **总分一律由维度相加，不采信模型自报的总分**。实测模型经常自报一个与分项对不上的总分，
 *    界面上会出现「七维 78、总分 85」这种自相矛盾。
 * 2) **维度按量表的顺序与满分重建**，不按模型给的顺序。多给的维度丢掉，少给的补 0 并注明，
 *    这样前端永远拿到固定 4 或 7 行，不会因为模型的一次抽风而少一行。
 */

import { getRubric, resolveRubricKey } from './rubric.js'

export const levelOf = (score, max = 25) => {
  const r = score / max
  if (r >= 0.88) return '优秀'
  if (r >= 0.72) return '良好'
  if (r >= 0.6) return '合格'
  return '待改进'
}

const clampInt = (v, min, max, fallback) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

/**
 * 截断并保留可读性。
 *
 * 不能直接 slice：prompt 要求 comment ≤60 字，但模型经常写到 70 字，
 * 硬切会留下「仅活动栏总时长30分钟与」这种半截话——读者以为是渲染坏了。
 * 所以优先退到最近的句读处断开，再补省略号；找不到合适断点时（整句就是很长）
 * 才硬切。阈值 55% 是为了避免「切在第一个逗号」导致内容只剩一半。
 */
const BREAKS = ['。', '；', '！', '？', '，', '、', '：']

const trim = (v, max) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim()
  if (s.length <= max) return s
  const head = s.slice(0, max - 1)
  let cut = -1
  BREAKS.forEach((ch) => {
    const i = head.lastIndexOf(ch)
    if (i > cut) cut = i
  })
  return (cut > max * 0.55 ? head.slice(0, cut) : head) + '…'
}

/** 各量表的兜底建议：模型一条建议都不给时至少给用户可执行的三条 */
const FILLER = {
  paper: ['补全关键信息的来源标注', '把结论部分写得更具体可验证', '统一文中术语与标点格式'],
  lesson: ['在教学过程表里补齐每个环节的学生活动', '为每条教学目标各配一种可判定的评价方式', '把空栏的素材与教具说明按实际上课内容填实']
}

/**
 * @param {object} raw 模型返回的 json
 * @param {object} ctx
 * @param {string} [ctx.rubricKey] 本次使用的量表 key
 * @param {string} [ctx.model]
 * @param {number} [ctx.inputChars]
 * @param {boolean} [ctx.truncated]
 * @param {number} [ctx.latencyMs]
 * @param {string} [ctx.requestId]
 */
export function normalizeReview(raw, ctx = {}) {
  const rubricKey = ctx.rubricKey || resolveRubricKey({ work: ctx.work || {} })
  const rubric = getRubric(rubricKey)

  const byKey = new Map()
  const list = Array.isArray(raw?.dimensions) ? raw.dimensions : []
  list.forEach((d) => {
    const key = String(d?.key || '').trim()
    if (key) byKey.set(key, d)
  })

  const dimensions = rubric.dimensions.map((dim) => {
    const got = byKey.get(dim.key)
    const score = clampInt(got?.score, 0, dim.max, 0)
    return {
      key: dim.key,
      name: dim.name,
      score,
      max: dim.max,
      level: levelOf(score, dim.max),
      // block 让前端能说清「这条证据取自教案的哪一块」，也让评语可回溯
      block: dim.block || '',
      comment: trim(got?.comment, 60) || '模型未给出该维度评语。',
      evidence: trim(got?.evidence, 40) || '（无对应文本）'
    }
  })

  const total = dimensions.reduce((s, d) => s + d.score, 0)

  let suggestions = Array.isArray(raw?.suggestions)
    ? raw.suggestions.map((s) => trim(s, 40)).filter(Boolean)
    : []
  suggestions = suggestions.slice(0, 5)
  if (suggestions.length < 3) {
    const filler = FILLER[rubricKey] || FILLER.paper
    suggestions = [...new Set([...suggestions, ...filler])].slice(0, 3)
  }

  // 亮点只在教案量表里要求；通用量表模型偶尔也会给，有就收着，没有就不显示
  const highlights = Array.isArray(raw?.highlights)
    ? raw.highlights.map((h) => trim(h, 40)).filter(Boolean).slice(0, 3)
    : []

  const summary = trim(raw?.summary, 260) || '模型未给出总评。'

  return {
    total,
    dimensions,
    highlights,
    summary,
    suggestions,
    rubric: rubric.version,
    rubricKey: rubric.key,
    rubricName: rubric.name,
    promptVersion: rubric.promptVersion,
    model: ctx.model || 'unknown',
    source: 'deepseek',
    inputChars: ctx.inputChars || 0,
    truncated: Boolean(ctx.truncated),
    createdAt: new Date().toISOString(),
    latencyMs: ctx.latencyMs || 0,
    requestId: ctx.requestId || ''
  }
}

/** 尝试从模型输出里抠出 json（有些模型会把 json 包在 ```json 里，或前后带一句话） */
export function extractJson(content) {
  const s = String(content || '').trim()
  if (!s) return null
  try {
    return JSON.parse(s)
  } catch {
    /* 继续尝试 */
  }
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim())
    } catch {
      /* 继续 */
    }
  }
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1))
    } catch {
      /* 放弃 */
    }
  }
  return null
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  // x-api-key：用户自带密钥走中继时放在这个头里，不放进请求体，避免被日志整段记下
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store'
}

export function ok(data, status = 200) {
  return new Response(JSON.stringify({ ok: true, data }), { status, headers: CORS })
}

export function fail(status, code, retryable = false, extra = {}) {
  return new Response(
    JSON.stringify({
      ok: false,
      error: { code, message: extra.message || code, retryable, ...extra }
    }),
    { status, headers: CORS }
  )
}

export const CORS_HEADERS = CORS
