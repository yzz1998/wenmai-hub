/**
 * 统一内容层 —— 全站唯一的数据入口。
 *
 * ┌ 静态语料（策展，只读）  剪纸 241 + 畲族 30  ─┐
 * ├ 动态素材（可维护）      闽东知识库 38 + 用户新增 ─┤→ buildEntries() → 309+ 条统一 Entry
 * └ 教学成果                8 条示例                ─┘
 *
 * 所有页面都不直接 import 某一份 JSON，而是通过这里拿数据：
 * 换数据源、加第四个专题时，只需要改这一个文件。
 */
import papercutData from './papercut.json'
import sheData from './she.json'
import hsCh2 from './hs-ch2.json'
import hsCh5 from './hs-ch5.json'
import mindongData from './mindong.json'
import worksData from './works.json'
import { COLLECTION_MAP } from './collections'
import { categoryName } from './taxonomy'

export const PAPERCUT_ENTRIES = papercutData.entries
export const SHE_ENTRIES = sheData.entries
export const SEED_MATERIALS = mindongData.entries
export const SEED_WORKS = worksData

/** 课程章节库（《人类与社会》第二章 / 第五章）—— 章级元数据 + 条目 */
export const COURSE_CHAPTERS = [hsCh2, hsCh5]
export const COURSE_ENTRIES = COURSE_CHAPTERS.flatMap((c) => c.entries)

/** 按专题取章节元数据（用于库头展示） */
export const chapterOf = (collection) => COURSE_CHAPTERS.find((c) => c.collection === collection) || null

/** 只读策展语料 + 课程章节（剪纸 / 畲族 / 课程两章） */
export const STATIC_ENTRIES = [...PAPERCUT_ENTRIES, ...SHE_ENTRIES, ...COURSE_ENTRIES]

/* ------------------------------------------------------------------ */
/* 归一化                                                              */
/* ------------------------------------------------------------------ */

/**
 * 把一条素材（可能来自种子数据、也可能是用户在管理页新增、或旧版本 localStorage）
 * 补齐为统一 Entry 结构。幂等，可重复调用。
 */
export function normalizeEntry(raw) {
  if (!raw) return null
  const collection = raw.collection || 'mindong'
  const meta = COLLECTION_MAP[collection]

  const media = Array.isArray(raw.media)
    ? raw.media
    : raw.image
      ? [
          {
            src: raw.image,
            full: raw.image,
            kind: 'photo',
            credit: raw.imageCredit?.site || '',
            creditPage: raw.imageCredit?.page || '',
            creditTitle: raw.imageCredit?.title || '',
            note: raw.imageNote || '',
            alt: raw.title
          }
        ]
      : []

  return {
    ...raw,
    collection,
    subtitle: raw.subtitle || raw.level || '',
    body: Array.isArray(raw.body) ? raw.body : raw.body ? [String(raw.body)] : [],
    tags: raw.tags || [],
    media,
    links: raw.links || (raw.sourceUrl ? [[raw.source || '来源', raw.sourceUrl]] : []),
    facets: raw.facets || {},
    status: raw.status || 'published',
    categoryLabel: raw.categoryLabel || categoryName(collection, raw.category),
    collectionLabel: meta?.short || '条目'
  }
}

/** 合并全部条目（含用户维护后的知识素材）—— 只读语料同样过一遍归一化，保证字段齐备 */
export function buildEntries(materials) {
  const live = (materials || SEED_MATERIALS).map(normalizeEntry)
  return [...STATIC_ENTRIES.map(normalizeEntry), ...live]
}

export function getEntry(entries, id) {
  if (!id) return null
  return entries.find((e) => e.id === id) || null
}

/** 专题内的兄弟条目序列 —— 供详情页「上一件 / 下一件」使用 */
export function siblingsOf(entries, entry) {
  if (!entry) return []
  return entries.filter((e) => e.collection === entry.collection && e.category === entry.category)
}

/* ------------------------------------------------------------------ */
/* 相关条目：跨馆关联                                                  */
/* ------------------------------------------------------------------ */

/** 标题/正文的二元组集合，用于粗粒度语义重叠计算 */
function bigrams(text) {
  const s = String(text || '').replace(/[\s\p{P}]+/gu, '')
  const out = new Set()
  for (let i = 0; i < s.length - 1; i += 1) out.add(s.slice(i, i + 2))
  return out
}

/**
 * 相关条目推荐。
 * 刻意允许跨专题命中：这是「三馆合为一库」最有价值的地方 ——
 * 查「凤凰装」时能同时看到畲族展项与剪纸中的凤凰纹样。
 */
export function relatedEntries(entry, entries, limit = 4) {
  if (!entry) return []
  const tags = new Set(entry.tags || [])
  const titleGrams = bigrams(entry.title)

  const scored = entries
    .filter((e) => e.id !== entry.id)
    .map((e) => {
      let score = 0
      ;(e.tags || []).forEach((t) => {
        if (tags.has(t)) score += 4
      })
      // 标题二元组重叠（阈值化，避免长标题虚高）
      let overlap = 0
      bigrams(e.title).forEach((g) => {
        if (titleGrams.has(g)) overlap += 1
      })
      if (overlap >= 2) score += Math.min(overlap, 6)
      // 同专题同类：优先，但权重低于标签命中
      if (e.collection === entry.collection && e.category === entry.category) score += 3
      // 跨专题命中额外加分，让「另见」真正跨出去
      if (e.collection !== entry.collection && score > 0) score += 2
      return { entry: e, score }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  // 最多 2 条跨专题，保证「另见」与「同类」都出现
  const cross = scored.filter((s) => s.entry.collection !== entry.collection).slice(0, 2)
  const same = scored.filter((s) => s.entry.collection === entry.collection).slice(0, limit)
  return [...same, ...cross].slice(0, limit).map((s) => s.entry)
}

/* ------------------------------------------------------------------ */
/* 站点统计                                                            */
/* ------------------------------------------------------------------ */
export function computeStats(entries) {
  const byCollection = {}
  let mediaCount = 0
  const tagSet = new Set()
  entries.forEach((e) => {
    byCollection[e.collection] = (byCollection[e.collection] || 0) + 1
    mediaCount += (e.media || []).length
    ;(e.tags || []).forEach((t) => tagSet.add(t))
  })
  return {
    total: entries.length,
    media: mediaCount,
    tags: tagSet.size,
    byCollection,
    papercut: byCollection.papercut || 0,
    she: byCollection.she || 0,
    mindong: byCollection.mindong || 0
  }
}
