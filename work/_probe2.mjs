/**
 * 基线探测：用真实的教案量表 prompt 打一次 deepseek-flash。
 * 目的只有一个：量出「需要多少 max_tokens、实际要等多久、content 会不会被思维链挤空」。
 */
import fs from 'node:fs'
import { buildMessages } from '../cloud-functions/_lib/rubric.js'

const KEY = 'sk-b97688c3e4ca45ebb69543d372c50bfb'
const BASE = 'https://api.deepseek.com'
const text = fs.readFileSync('work/fixtures/lesson-plan.txt', 'utf8')

const messages = buildMessages({
  rubricKey: 'lesson',
  work: { title: '唐宋经典诗词解析', type: 'lesson_plan', grade: '5-6 年级', course: '语文' },
  bundle: { text }
})

const sysLen = messages[0].content.length
const userLen = messages[1].content.length
console.log(`prompt: system ${sysLen} 字 / user ${userLen} 字`)

async function run({ label, maxTokens, effort, model = 'deepseek-flash' }) {
  const started = Date.now()
  const body = {
    model,
    messages,
    temperature: 0.2,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    stream: false
  }
  if (effort) body.reasoning_effort = effort
  let res
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(240000)
    })
  } catch (e) {
    console.log(`[${label}] fetch 失败 ${Date.now() - started}ms`, e?.name, e?.message)
    return null
  }
  const raw = await res.text()
  const ms = Date.now() - started
  if (!res.ok) {
    console.log(`[${label}] HTTP ${res.status} ${ms}ms ${raw.slice(0, 300)}`)
    return null
  }
  const j = JSON.parse(raw)
  const ch = j.choices?.[0] || {}
  const content = ch.message?.content || ''
  const reasoning = ch.message?.reasoning_content || ''
  let parsed = null
  try {
    parsed = JSON.parse(content)
  } catch {
    parsed = null
  }
  console.log(
    `[${label}] ${ms}ms | finish=${ch.finish_reason} | out=${j.usage?.completion_tokens} | reasoning=${j.usage?.completion_tokens_details?.reasoning_tokens ?? '?'} | content=${content.length}字 reasoning=${reasoning.length}字 | json=${parsed ? 'OK' : 'FAIL'}`
  )
  if (parsed) {
    const dims = parsed.dimensions || []
    console.log(
      '  dims:',
      dims.map((d) => `${d.key}=${d.score}`).join(' '),
      '| sum=',
      dims.reduce((s, d) => s + (Number(d.score) || 0), 0),
      '| highlights=',
      (parsed.highlights || []).length,
      '| suggestions=',
      (parsed.suggestions || []).length
    )
  } else if (content) {
    console.log('  content 头部:', content.slice(0, 160))
  }
  return { ms, parsed, content }
}

;(async () => {
  await run({ label: 'flash/max6000/effort=high', maxTokens: 6000 })
  await run({ label: 'flash/max6000/effort=low', maxTokens: 6000, effort: 'low' })
})()
