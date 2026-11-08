/**
 * POST /api/review —— 学生成果 AI 评阅（中继模式，可选）。
 * GET  /api/review —— 健康探针（量表版本、可用量表、是否有服务端密钥、是否 mock）。
 *
 * 定位：评阅的主通道是**浏览器直连模型**，密钥由用户在网页的设置面板里填，
 * 存在他自己的 localStorage。这个函数退成一条备用的中继通道：
 * 当直连被浏览器插件、企业网关或 CORS 策略拦住时，同一个请求改从本站转发出去。
 *
 * 因此这里的密钥优先取请求头 `x-api-key`（用户自己那把），取不到才回落到
 * 环境变量 `DEEPSEEK_API_KEY`（站点自备一把给公众用，可选）。
 * 函数本身不保存、不记录任何用户的 Key。
 *
 * 请求体上限 6MB / 墙钟 120s 是平台硬限。本函数的时间预算：
 *   单次 100s，重试前先算剩余预算，宁可不重试也不被平台掐断（那样前端连结构化错误都收不到）。
 */

import { buildMessages, getRubric, maxTokensFor, resolveRubricKey, RUBRIC_META } from '../_lib/rubric.js'
import { callDeepSeek } from '../_lib/deepseek.js'
// levelOf 在 normalize.js 里（与 normalizeReview 同一处维护四等级口径），不在 rubric.js
import { CORS_HEADERS, extractJson, fail, levelOf, normalizeReview, ok } from '../_lib/normalize.js'

const MAX_BODY_BYTES = 6 * 1024 * 1024
// 与前端 DOC_LIMITS.maxChars 对齐：客户端在提交前就会截到 30000，
// 服务端这个值只是「绕过前端的请求」的兜底闸门，不承担截断职责。
const MAX_TEXT_CHARS = 30000
const MIN_TEXT_CHARS = 200

/* ---------------- 简易限流（尽力而为） ----------------
   EdgeOne 的实例是无状态的，进程内计数只能挡住「同一实例上的短时连点」，
   挡不住分布式刷接口。真实配额需要在控制台/网关层配，这里如实标注，不假装已经防住。 */
const hits = new Map()
const WINDOW_MS = 60000
const MAX_PER_WINDOW = 4

function rateLimited(ip) {
  if (!ip) return false
  const now = Date.now()
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  arr.push(now)
  hits.set(ip, arr)
  if (hits.size > 500) hits.clear() // 防止内存无限增长
  return arr.length > MAX_PER_WINDOW
}

/** 服务端 Mock：只为联调界面与验证清洗逻辑，按所选量表的维度生成 */
function mockResult({ text, work, truncated, rubricKey }) {
  const rubric = getRubric(rubricKey)
  const n = String(text).length
  const seed = n % 17
  const dimensions = rubric.dimensions.map((d, i) => {
    const score = Math.max(0, Math.min(d.max, Math.round(d.max * (0.72 + ((seed + i * 3) % 5) * 0.04))))
    return {
      key: d.key,
      name: d.name,
      score,
      max: d.max,
      block: d.block || '',
      level: levelOf(score, d.max),
      comment: '（服务端 Mock）该维度评语示例，用于验证界面与数据链路。',
      evidence: '（无对应文本）'
    }
  })
  return {
    total: dimensions.reduce((s, d) => s + d.score, 0),
    dimensions,
    highlights: rubric.key === 'lesson' ? ['（Mock）环节时长与标注课时基本对得上'] : [],
    summary: `（服务端 Mock 输出）《${work?.title || '成果'}》的评阅结果由本地规则生成，未调用真实模型。关掉 REVIEW_MOCK 后即为真实评阅。`,
    suggestions: ['补全关键信息的来源标注', '把结论写得更具体可验证', '统一术语与标点格式'],
    rubric: rubric.version,
    rubricKey: rubric.key,
    rubricName: rubric.name,
    promptVersion: 'mock',
    model: 'server-mock',
    source: 'mock',
    inputChars: n,
    truncated: Boolean(truncated),
    createdAt: new Date().toISOString()
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export function onRequestGet(context) {
  const env = context.env || {}
  return ok({
    service: 'review',
    version: '1.2.0',
    role: 'relay',
    rubric: RUBRIC_META,
    // 现在主通道是浏览器直连，服务端有没有 Key 只影响「中继能不能替你兜住」
    hasServerKey: Boolean(env.DEEPSEEK_API_KEY),
    hasKey: Boolean(env.DEEPSEEK_API_KEY),
    mock: env.REVIEW_MOCK === '1',
    model: env.DEEPSEEK_MODEL || 'deepseek-chat',
    limits: { maxChars: MAX_TEXT_CHARS, maxBodyMB: 6, wallClockSec: 120 }
  })
}

export async function onRequestPost(context) {
  const t0 = Date.now()
  const env = context.env || {}
  const requestId = context.uuid || context.server?.requestId || ''

  const declared = Number(context.request.headers.get('content-length') || 0)
  if (declared > MAX_BODY_BYTES) {
    return fail(413, 'PAYLOAD_TOO_LARGE', false, { message: '请求体超过 6MB' })
  }

  let body
  try {
    body = await context.request.json()
  } catch {
    return fail(400, 'BAD_REQUEST', false, { message: '请求体不是合法 JSON' })
  }

  // v1 = 老客户端只传文本；v2 = 带 materials 清单、模型名与量表 key。
  // 两个版本都收，别让还在缓存里的旧页面直接报错。
  const ver = Number(body?.schemaVersion || 0)
  if (!body || (ver !== 1 && ver !== 2)) {
    return fail(400, 'BAD_REQUEST', false, { message: '不支持的请求版本' })
  }

  // 用户自带的密钥优先；服务端环境变量只作兜底
  const apiKey = String(context.request.headers.get('x-api-key') || '').trim() || env.DEEPSEEK_API_KEY || ''
  const reqModel = String(body.model || '').trim() || env.DEEPSEEK_MODEL || 'deepseek-chat'

  const text = String(body.text || '').trim()
  if (!text) {
    return fail(400, 'BAD_REQUEST', false, { message: '缺少 text 字段' })
  }
  if (text.length > MAX_TEXT_CHARS) {
    return fail(413, 'PAYLOAD_TOO_LARGE', false, { message: `正文超过 ${MAX_TEXT_CHARS} 字` })
  }
  if (text.replace(/\s/g, '').length < MIN_TEXT_CHARS) {
    return fail(422, 'TEXT_TOO_SHORT', false, { message: `有效正文不足 ${MIN_TEXT_CHARS} 字` })
  }

  if (rateLimited(context.clientIp)) {
    return fail(429, 'RATE_LIMITED', true, {
      message: '请求过于频繁',
      retryAfterMs: 20000
    })
  }

  // 量表选择只在这里做一次：显式 key > 成果类型 > 默认。前端直连走的是同一个函数，
  // 所以「同一份成果换个通道评出来的分数不一样」这种事不会发生。
  const rubricKey = resolveRubricKey({ work: body.work || {}, rubric: body.rubric })
  const rubric = getRubric(rubricKey)
  const maxTokens =
    Number(body.maxTokens) > 0
      ? Math.min(12000, Number(body.maxTokens))
      : maxTokensFor(rubricKey, text.replace(/\s/g, '').length)
  const effort = String(body.effort || '').trim()

  if (env.REVIEW_MOCK === '1') {
    return ok({
      ...mockResult({ text, work: body.work, truncated: body.truncated, rubricKey }),
      latencyMs: Date.now() - t0,
      requestId
    })
  }

  if (!apiKey) {
    return fail(503, 'NO_API_KEY', false, {
      message: '请求既未携带 x-api-key，服务端也未配置 DEEPSEEK_API_KEY'
    })
  }

  const messages = buildMessages({
    rubricKey,
    work: body.work || {},
    bundle: {
      text,
      truncated: Boolean(body.truncated),
      materials: body.materials || null
    }
  })

  // 凭据按请求携带，不落到实例上：同一个实例可能连续服务多个用户
  const auth = { apiKey, model: reqModel, baseUrl: env.DEEPSEEK_BASE_URL }

  let content
  let model
  let finishReason = ''
  try {
    const r = await callDeepSeek({ env, messages, auth, maxTokens, effort })
    content = r.content
    model = r.model
    finishReason = r.finishReason || ''
  } catch (e) {
    // UpstreamError 的 code 已在上游映射过（INVALID_KEY / RATE_LIMITED / UPSTREAM_TIMEOUT / OUTPUT_TRUNCATED …），
    // 这里只负责把它翻成合适的 HTTP 状态，别把 429 报成 502 —— 前端靠状态码决定要不要倒计时重试。
    const code = e?.code || 'UPSTREAM_ERROR'
    const status =
      code === 'RATE_LIMITED'
        ? 429
        : code === 'UPSTREAM_TIMEOUT'
          ? 504
          : code === 'INVALID_KEY'
            ? 401
            : code === 'INSUFFICIENT_BALANCE'
              ? 402
              : 502
    return fail(status, code, Boolean(e?.retryable), {
      message: e?.message || '调用模型失败',
      retryAfterMs: e?.retryAfterMs || 0
    })
  }

  let parsed = extractJson(content)

  // 输出不是合法 JSON：追加一条纠正消息再要一次，不重跑整个评分提示（省 token、省时间）。
  // 注意这里也要带上同样的 maxTokens —— 用默认值重来一遍，长量表还会被截断。
  if (!parsed) {
    try {
      const retry = await callDeepSeek({
        env,
        auth,
        maxTokens,
        effort,
        messages: [
          ...messages,
          { role: 'assistant', content: String(content).slice(0, 2000) },
          {
            role: 'user',
            content:
              '你上一次的输出不是合法 json。请只输出一个 json 对象，不要 markdown 代码块、不要任何解释文字，结构必须与 system 中给定的 json 结构完全一致，dimensions 必须包含量表里的全部维度。'
          }
        ]
      })
      parsed = extractJson(retry.content)
      model = retry.model
    } catch (e) {
      return fail(502, 'BAD_OUTPUT', true, { message: '模型输出无法解析为 JSON' })
    }
  }

  if (!parsed || !Array.isArray(parsed.dimensions)) {
    return fail(502, 'BAD_OUTPUT', true, { message: '模型输出缺少 dimensions 字段' })
  }

  const data = normalizeReview(parsed, {
    rubricKey,
    work: body.work || {},
    model,
    inputChars: text.replace(/\s/g, '').length,
    truncated: Boolean(body.truncated),
    latencyMs: Date.now() - t0,
    requestId
  })

  return ok({ ...data, finishReason, rubric: rubric.version, rubricKey: rubric.key })
}
