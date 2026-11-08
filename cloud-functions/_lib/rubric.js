/**
 * 量表门面：对外只暴露「按 key 取量表」「按成果解析该用哪套量表」「拼 messages」。
 *
 * 为什么要有这一层：系统里现在有两套量表（通用成果四维 / 教案七维），
 * 而**同一份 prompt 必须被前端直连与云函数中继共用**。如果两边各自挑量表，
 * 就会出现「同一次评阅，走直连用四维、走中继用七维」这种没人能复现的分数差异。
 * 所以量表选择只在这里做一次：`resolveRubricKey()`。
 *
 * 选择规则（按优先级）：
 *   1. 请求里显式指定且存在 → 用它（便于以后做「手动换量表」）
 *   2. 成果类型是 lesson_plan → 教案量表
 *   3. 其余 → 通用量表
 * 注意顺序：**类型优先于默认值**，但显式指定优先于类型。否则「一篇教案想按论文标准看」做不到。
 */

import { RUBRIC as PAPER, DIMENSIONS as PAPER_DIMENSIONS, SYSTEM_PROMPT as PAPER_SYSTEM_PROMPT, buildUserPrompt as paperUserPrompt, VERSION as PAPER_VERSION, PROMPT_VERSION as PAPER_PROMPT_VERSION } from './rubrics/paper.js'
import { RUBRIC as LESSON } from './rubrics/lesson.js'

export const RUBRICS = {
  [PAPER.key]: PAPER,
  [LESSON.key]: LESSON
}

export const DEFAULT_RUBRIC_KEY = PAPER.key

export const RUBRIC_KEYS = Object.keys(RUBRICS)

/** 按 key 取量表，未知 key 退回默认量表（不抛错：评阅不该因为一个错拼的 key 就整单失败） */
export function getRubric(key) {
  return RUBRICS[String(key || '').trim()] || RUBRICS[DEFAULT_RUBRIC_KEY]
}

/**
 * 解析本次评阅该用哪套量表。
 * @param {{work?: object, rubric?: string}} args
 * @returns {string} rubric key
 */
export function resolveRubricKey({ work = {}, rubric = '' } = {}) {
  const explicit = String(rubric || '').trim()
  if (explicit && RUBRICS[explicit]) return explicit
  const type = String(work?.type || '').trim()
  const byType = RUBRIC_KEYS.find((k) => RUBRICS[k].appliesTo.includes(type))
  return byType || DEFAULT_RUBRIC_KEY
}

/**
 * 组装 chat completions 的 messages。
 * @param {{rubricKey?: string, work?: object, bundle?: object}} args
 */
export function buildMessages({ rubricKey = '', work = {}, bundle = {} }) {
  const rubric = getRubric(rubricKey || resolveRubricKey({ work }))
  return [
    { role: 'system', content: rubric.systemPrompt },
    {
      role: 'user',
      content: rubric.buildUserPrompt({
        work,
        text: String(bundle?.text || ''),
        truncated: Boolean(bundle?.truncated),
        materials: bundle?.materials || null
      })
    }
  ]
}

/**
 * 输出 token 预算。
 *
 * 这里踩过一个真实的坑，而且是两次：deepseek-flash 是推理型模型，
 * `max_tokens` **同时**约束思维链与正文。第一次写死 1400，思维链把它吃光，
 * `content` 直接为空、`finish_reason` 是 `length`，前端只看到「模型返回格式异常」。
 * 后来按「维度数 × 字段量」估算，教案量表得 2200 —— 实测仍然不够：
 * 一份 3373 字的教案，思维链就用了 2084~3293 token，
 * 于是每次评阅都要先失败一次、再由上层加压重试，白白多一次调用和十几秒。
 *
 * 所以预算拆成两段相加，而不是给正文乘一个系数：
 *   正文段 = 维度数 × 150 + 700（每维 comment 60 字 + evidence 40 字，加总评/建议/亮点）
 *   推理段 = 3400 + 字数 / 40（随正文增长，但不是线性）
 * 推理段的两个实测点：3373 字 → 思维链 2650~3293；23674 字 → 3011。
 * 长文增长很慢（2 万字只多 300 token 左右），所以按 1/40 的斜率放大已足够，
 * 基线上沿取 3400 是给「同一篇文本两次跑出差 600 token」这种抖动留的余量。
 * 两者相加后钳在 4000–8000：低于 4000 必然重试一次，高于 8000 对延迟没有好处，
 * 而平台墙钟只有 120 秒。
 */
export function maxTokensFor(rubricKey, inputChars = 0) {
  const r = getRubric(rubricKey)
  const content = r.dimensions.length * 150 + 700
  const chars = Math.max(0, Number(inputChars) || 0)
  const reasoning = 3400 + chars / 40
  return Math.min(8000, Math.max(4000, Math.round(content + reasoning)))
}

/* ---------------- 兼容导出 ---------------- */
/* 早期版本只有一套量表，代码里直接 import 了下面这些名字。
   保留它们是刻意的：一次改名会让前端、云函数、测试脚本三处同时报错，
   而这三处并不总是同时被改到。 */

export const RUBRIC_VERSION = PAPER_VERSION
export const PROMPT_VERSION = PAPER_PROMPT_VERSION
export const DIMENSIONS = PAPER_DIMENSIONS
export const SYSTEM_PROMPT = PAPER_SYSTEM_PROMPT
export const buildUserPrompt = paperUserPrompt

/**
 * 健康探针与前端展示用的量表元信息。
 *
 * 顶层保留 `version / total / dimensions`（老调用方按这个读通用量表），
 * 另给 `rubrics[]` 列全部量表——前端要靠它显示「这次用的是哪套、几维、每维多少分」。
 */
export const RUBRIC_META = {
  default: DEFAULT_RUBRIC_KEY,
  version: PAPER_VERSION,
  total: PAPER.total,
  dimensions: PAPER.dimensions.map((d) => ({ key: d.key, name: d.name, max: d.max })),
  rubrics: RUBRIC_KEYS.map((k) => {
    const r = RUBRICS[k]
    return {
      key: r.key,
      version: r.version,
      name: r.name,
      shortName: r.shortName,
      total: r.total,
      dimsHint: r.dimsHint,
      bodyLabel: r.bodyLabel,
      appliesTo: r.appliesTo,
      dimensions: r.dimensions.map((d) => ({ key: d.key, name: d.name, max: d.max, block: d.block }))
    }
  })
}
