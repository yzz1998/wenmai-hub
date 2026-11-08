/**
 * DeepSeek 调用（OpenAI 兼容协议）。
 *
 * 关键约束来自 EdgeOne 云函数：**墙钟 120 秒**。所以这里的时间预算是：
 * 单次请求 100 秒超时 + 最多一次重试，且重试前检查剩余预算。
 * 如果把重试做成无条件的，第二次一定被平台杀掉，前端只能拿到网关错误页，
 * 连「超时」这个结构化错误都收不到。
 *
 * 参数选择（含一次真实的踩坑）：
 * - temperature 0.2：评分任务要稳定，同一篇文本重复评阅的分差控制在 3 分以内。
 * - response_format json_object：强约束输出结构；官方要求 prompt 里出现 "json" 字样（已满足）。
 * - max_tokens **必须按量表算，不能写死小值**。deepseek-flash 是推理型模型，
 *   max_tokens 同时约束思维链与正文：实测一份 3700 字教案，思维链就用了 3293 token，
 *   原来写死的 1400 会让 content 直接为空、finish_reason=length，前端只看到「格式异常」。
 *   这不是超时，是预算不够——但用户看到的都是「评不出结果」。
 * - reasoning_effort：deepseek-flash 支持 low/high/max。默认不传（模型默认 high，质量优先），
 *   只有在上层判定「快超时了」时才降级成 low 换取速度。
 */

const TIMEOUT_MS = 100000
const RETRY_BUDGET_MS = 115000
const RETRY_DELAYS = [1000, 2500]

/** 允许的推理强度；不是所有兼容端点都认这个字段，所以只在显式要求时才传 */
const EFFORTS = new Set(['low', 'medium', 'high', 'max'])

class UpstreamError extends Error {
  constructor(code, message, { retryable = false, retryAfterMs = 0, detail = '' } = {}) {
    super(message || code)
    this.code = code
    this.retryable = retryable
    this.retryAfterMs = retryAfterMs
    this.detail = detail
  }
}

/**
 * 单次调用。
 *
 * `auth` 是「由调用方临时提供的凭据」，优先于环境变量：
 * 现在密钥默认由用户在网页里填写，中继时通过 `x-api-key` 带过来，
 * 云函数不需要、也不应该在部署环境里长期保存别人的 Key。
 * 环境变量仍保留，作为「站点自己出一把 Key 给公众用」的可选配置。
 */
async function callOnce({ env, messages, signal, maxTokens = 4000, effort = '', auth = null }) {
  const base = (auth?.baseUrl || env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '')
  const model = auth?.model || env.DEEPSEEK_MODEL || 'deepseek-chat'
  const apiKey = auth?.apiKey || env.DEEPSEEK_API_KEY

  const payload = {
    model,
    messages,
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: maxTokens,
    frequency_penalty: 0,
    presence_penalty: 0,
    response_format: { type: 'json_object' },
    stream: false
  }
  if (effort && EFFORTS.has(effort)) payload.reasoning_effort = effort

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
    signal
  })

  if (res.status === 401 || res.status === 403) {
    throw new UpstreamError('INVALID_KEY', '模型密钥无效或无权限', { retryable: false })
  }
  if (res.status === 402) {
    throw new UpstreamError('INSUFFICIENT_BALANCE', '模型账户余额不足', { retryable: false })
  }
  if (res.status === 429) {
    const ra = Number(res.headers.get('retry-after'))
    throw new UpstreamError('RATE_LIMITED', '模型服务限流', {
      retryable: true,
      retryAfterMs: Number.isFinite(ra) && ra > 0 ? ra * 1000 : 20000
    })
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // 部分兼容端点不认 reasoning_effort 或 json_object，会回 400。
    // 这类错误可以靠「去掉可选参数」自救，交给上层重试一次，并带上这个标记。
    const paramIssue = res.status === 400 && /reasoning_effort|response_format|json_object|max_tokens/i.test(body)
    throw new UpstreamError(
      paramIssue ? 'BAD_PARAM' : 'UPSTREAM_ERROR',
      `上游返回 ${res.status} ${body.slice(0, 160)}`,
      { retryable: paramIssue || res.status >= 500 || res.status === 408 }
    )
  }

  const json = await res.json().catch(() => null)
  const choice = json?.choices?.[0] || {}
  const content = choice.message?.content
  const reasoning = choice.message?.reasoning_content || ''
  const finishReason = choice.finish_reason || ''

  if (!content) {
    // 这里要区分两种「空」：预算被思维链吃光 vs 上游真的没给内容。
    // 前者提高 max_tokens 就能救，后者换请求也没用 —— 给前端的建议完全不同。
    if (finishReason === 'length') {
      throw new UpstreamError(
        'OUTPUT_TRUNCATED',
        `输出预算被耗尽（推理占用 ${json?.usage?.completion_tokens_details?.reasoning_tokens ?? '较多'} token），需要加大 max_tokens 重试`,
        { retryable: true, detail: reasoning.slice(0, 200) }
      )
    }
    throw new UpstreamError('BAD_OUTPUT', '上游返回内容为空', { retryable: true })
  }

  return {
    content,
    model: json?.model || model,
    finishReason,
    reasoningChars: reasoning.length,
    usage: json?.usage || null
  }
}

/**
 * 带超时与重试的调用。
 *
 * 重试策略是**有差别**的，不是一律重来：
 * - `OUTPUT_TRUNCATED`：把 max_tokens 放大（×1.6，上限 12000）再试，这是唯一有效的解法。
 * - `BAD_PARAM`：去掉 reasoning_effort 再试，兼容不认该字段的端点。
 * - 限流 / 5xx / 超时：原样重试，但必须先确认剩余预算够。
 *
 * @param {{env: object, messages: Array, maxTokens?: number, effort?: string,
 *          auth?: {apiKey?:string, baseUrl?:string, model?:string}}} args
 */
export async function callDeepSeek({ env, messages, maxTokens = 4000, effort = '', auth = null }) {
  const started = Date.now()
  let lastError = null
  let budget = maxTokens
  let currentEffort = effort

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt += 1) {
    if (attempt > 0) {
      const elapsed = Date.now() - started
      // 预算不够就不要再试，否则会被平台 120s 直接掐断
      if (elapsed + RETRY_DELAYS[attempt - 1] + 25000 > RETRY_BUDGET_MS) break
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]))
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const out = await callOnce({
        env,
        messages,
        signal: controller.signal,
        maxTokens: budget,
        effort: currentEffort,
        auth
      })
      return { ...out, attempts: attempt + 1, maxTokens: budget }
    } catch (e) {
      lastError = e
      if (e?.name === 'AbortError') {
        lastError = new UpstreamError('UPSTREAM_TIMEOUT', `模型 ${TIMEOUT_MS / 1000} 秒内未返回`, {
          retryable: Date.now() - started < 60000
        })
      }
      if (lastError?.code === 'OUTPUT_TRUNCATED') {
        budget = Math.min(12000, Math.round(budget * 1.6))
        // 截断说明推理太长，顺手降低推理强度，避免第二次又撞上限
        if (!currentEffort) currentEffort = 'low'
      }
      if (lastError?.code === 'BAD_PARAM') {
        currentEffort = ''
      }
      if (lastError instanceof UpstreamError && !lastError.retryable) throw lastError
      // 非 UpstreamError（网络层异常）按可重试处理
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError || new UpstreamError('UPSTREAM_ERROR', '调用模型失败', { retryable: true })
}

export { UpstreamError }
