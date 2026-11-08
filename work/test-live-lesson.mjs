/**
 * 真实链路实测：用 deepseek-flash 评阅一份真实教案（不经过浏览器、不经过云函数）。
 *
 * 这个脚本存在的唯一目的，是回答「线上那一套到底跑不跑得通、会不会超时」。
 * 所以它**不做任何简化**：直接 import 前端与云函数共用的那几个模块，
 * prompt、量表、token 预算、钳位逻辑全都是线上那一份，只把网络对面换成真的模型。
 *
 * 用法（key 只从环境变量读，不落盘）：
 *   DEEPSEEK_API_KEY=sk-xxx node work/test-live-lesson.mjs [样本文件] [maxTokens]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildMessages, maxTokensFor, resolveRubricKey, RUBRIC_META } from '../cloud-functions/_lib/rubric.js'
import { callDeepSeek } from '../cloud-functions/_lib/deepseek.js'
import { normalizeReview, extractJson } from '../cloud-functions/_lib/normalize.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const API_KEY = process.env.DEEPSEEK_API_KEY || ''
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-flash'
/** 长文压力测试：把样本机械拼接 N 份，纯粹为了把输入推到 2 万字以上，测的是延迟与预算，不是分数 */
const REPEAT = Math.max(1, Number(process.env.TEXT_REPEAT || 1))

const one = fs.readFileSync(path.resolve(HERE, 'fixtures/lesson-plan.txt'), 'utf8')
const text =
  REPEAT === 1
    ? one
    : Array.from({ length: REPEAT }, (_, i) => `【第 ${i + 1} 份教学材料】\n${one}`).join('\n\n')
const work = {
  id: 'live-lesson-1',
  title: '唐宋经典诗词解析',
  type: 'lesson_plan',
  grade: '5-6年级',
  course: '语文',
  summary: '以《元日》《九月九日忆山东兄弟》为例，教学生抓细节还原画面、说清表达作用。'
}

const line = (s = '') => console.log(s)
const rule = (t) => line(`\n${'='.repeat(4)} ${t} ${'='.repeat(Math.max(0, 56 - t.length * 2))}`)

if (!API_KEY) {
  console.error('缺少 DEEPSEEK_API_KEY')
  process.exit(2)
}

const rubricKey = resolveRubricKey({ work })
const chars = text.replace(/\s/g, '').length
const budget = Number(process.argv[3] || 0) || maxTokensFor(rubricKey, chars)

rule('本次调用参数')
line(`模型        ${MODEL} @ ${BASE_URL}`)
line(`量表        ${rubricKey}（${RUBRIC_META.rubrics.find((r) => r.key === rubricKey).name}）`)
line(`维度数      ${RUBRIC_META.rubrics.find((r) => r.key === rubricKey).dimensions.length}`)
line(`正文        ${chars} 字（非空白）`)
line(`max_tokens  ${budget}（maxTokensFor 给的是 ${maxTokensFor(rubricKey, chars)}）`)

const messages = buildMessages({ rubricKey, work, bundle: { text, truncated: false } })
const promptChars = messages.map((m) => m.content).join('').length
line(`prompt      ${promptChars} 字`)

rule('调用模型')
const t0 = Date.now()
let out
try {
  out = await callDeepSeek({ env: {}, messages, maxTokens: budget, auth: { apiKey: API_KEY, baseUrl: BASE_URL, model: MODEL } })
} catch (e) {
  const ms = Date.now() - t0
  line(`失败：${e.code} ${e.message}（${(ms / 1000).toFixed(1)}s）`)
  process.exit(1)
}
const ms = Date.now() - t0
const u = out.usage || {}
line(`耗时        ${(ms / 1000).toFixed(1)}s`)
line(`finish      ${out.finishReason}   尝试 ${out.attempts} 次   实际预算 ${out.maxTokens}`)
line(`tokens      prompt ${u.prompt_tokens ?? '?'} / completion ${u.completion_tokens ?? '?'} / 其中推理 ${u.completion_tokens_details?.reasoning_tokens ?? '?'}`)
line(`思维链       ${out.reasoningChars} 字（不计入 content）`)

rule('解析与钳位')
const raw = extractJson(out.content)
if (!raw) {
  line('模型输出无法解析为 json，前 400 字：')
  line(String(out.content).slice(0, 400))
  process.exit(1)
}
const review = normalizeReview(raw, {
  rubricKey,
  work,
  model: out.model,
  inputChars: chars,
  latencyMs: ms
})

const want = RUBRIC_META.rubrics.find((r) => r.key === rubricKey).dimensions
let bad = 0
review.dimensions.forEach((d, i) => {
  const spec = want[i]
  const flag = d.key === spec.key && d.score <= spec.max ? '✓' : '✗'
  if (flag === '✗') bad += 1
  line(`${flag} ${d.key.padEnd(12)} ${String(d.score).padStart(2)}/${d.max}  ${d.level}  ${d.comment.slice(0, 40)}`)
})
line(`\n维度顺序与满分：${bad === 0 ? '全部符合量表' : `${bad} 维不符`}`)
line(`总分        ${review.total}（= 七维之和 ${review.dimensions.map((d) => d.score).join('+')}）`)
line(`量表版本    ${review.rubricKey} / ${review.rubric}`)
line(`亮点        ${review.highlights.length} 条`)
review.highlights.forEach((h) => line(`  · ${h}`))
line(`总评        ${review.summary}`)
line(`建议        ${review.suggestions.length} 条`)
review.suggestions.forEach((s) => line(`  · ${s}`))

rule('超时判据')
line(`平台墙钟 120s，本次 ${(ms / 1000).toFixed(1)}s → ${ms < 120000 ? '在限内' : '超限，必须继续压缩'}`)

fs.writeFileSync(
  path.join(HERE, 'live-lesson-result.json'),
  JSON.stringify({ elapsedMs: ms, usage: u, finishReason: out.finishReason, attempts: out.attempts, maxTokens: out.maxTokens, review }, null, 2)
)
// 原始输出单独存一份：将来改清洗规则时，可以用它离线重算，不必再花一次调用
fs.writeFileSync(path.join(HERE, 'live-lesson-raw.json'), out.content)
line('结果已存 work/live-lesson-result.json')
