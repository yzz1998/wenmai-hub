/**
 * 最坏情况探测：把教案扩到接近 3 万字上限，看 effort=high 要等多久。
 * 这决定前端超时该设多少、降级重试该压到多长。
 */
import fs from 'node:fs'
import { buildMessages } from '../cloud-functions/_lib/rubric.js'

const KEY = 'sk-b97688c3e4ca45ebb69543d372c50bfb'
const BASE = 'https://api.deepseek.com'
const base = fs.readFileSync('work/fixtures/lesson-plan.txt', 'utf8')

// 复制并改写小节编号，模拟一份「写得非常啰嗦」的教案，直到接近 3 万字
let big = base
let round = 2
while (big.length < 29500) {
  big += `\n\n附：第 ${round} 轮补充教学设计说明\n` + base.split('\n').slice(4).join('\n')
  round += 1
}
big = big.slice(0, 30000)
console.log('正文', big.length, '字')

const messages = buildMessages({
  rubricKey: 'lesson',
  work: { title: '唐宋经典诗词解析（长文压测）', type: 'lesson_plan' },
  bundle: { text: big }
})

async function run(label, { maxTokens, effort }) {
  const started = Date.now()
  const body = {
    model: 'deepseek-flash',
    messages,
    temperature: 0.2,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' }
  }
  if (effort) body.reasoning_effort = effort
  let res
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300000)
    })
  } catch (e) {
    console.log(`[${label}] 失败 ${Date.now() - started}ms`, e?.name)
    return
  }
  const ms = Date.now() - started
  const j = await res.json().catch(() => null)
  if (!res.ok) {
    console.log(`[${label}] HTTP ${res.status} ${ms}ms`, JSON.stringify(j).slice(0, 200))
    return
  }
  const ch = j.choices?.[0] || {}
  const content = ch.message?.content || ''
  let ok = false
  try {
    ok = Boolean(JSON.parse(content)?.dimensions?.length)
  } catch {
    ok = false
  }
  console.log(
    `[${label}] ${ms}ms finish=${ch.finish_reason} out=${j.usage?.completion_tokens} reasoning=${j.usage?.completion_tokens_details?.reasoning_tokens ?? '?'} content=${content.length}字 json=${ok ? 'OK' : 'FAIL'}`
  )
}

;(async () => {
  await run('3万字/max1400(旧配置)', { maxTokens: 1400 })
  await run('3万字/max6000/effort=high', { maxTokens: 6000 })
  await run('3万字/max6000/effort=low', { maxTokens: 6000, effort: 'low' })
})()
