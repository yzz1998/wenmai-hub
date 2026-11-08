/**
 * 统一检索内核 —— 一套逻辑同时服务三个专题。
 *
 * 相比原知识库版本的三处升级：
 * 1) 字段表增加 subtitle / categoryLabel / collectionLabel，让「剪纸·花卉草木」
 *    这类分类词也能被搜到；
 * 2) 支持 collection 维度过滤（同一输入框可限定在某馆内搜）；
 * 3) 相关度排序引入「同专题优先」的微调，跨馆结果不会被同馆结果整体压掉。
 */

/** 极简中文分词：按分隔符切分，并为长中文串补二元组，兼顾召回与精度 */
export function tokenize(query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return []
  const parts = q.split(/[\s,，、；;|/]+/).filter(Boolean)
  const tokens = new Set(parts)
  parts.forEach((p) => {
    if (p.length >= 3 && /^[\u4e00-\u9fa5]+$/.test(p)) {
      for (let i = 0; i < p.length - 1; i += 1) tokens.add(p.slice(i, i + 2))
    }
  })
  return [...tokens]
}

const lower = (s) => String(s || '').toLowerCase()

/** 单条条目对查询串的得分与命中字段 */
export function scoreEntry(entry, query) {
  const tokens = tokenize(query)
  if (!tokens.length) return { score: 0, hits: [] }

  const fields = [
    { label: '标题', weight: 6, text: entry.title },
    { label: '标签', weight: 5, text: (entry.tags || []).join(' ') },
    { label: '分类', weight: 4, text: `${entry.categoryLabel || ''} ${entry.collectionLabel || ''}` },
    { label: '简介', weight: 3, text: entry.summary },
    { label: '地域', weight: 3, text: entry.region },
    { label: '副题', weight: 2, text: entry.subtitle },
    { label: '正文', weight: 2, text: (entry.body || []).join(' ') },
    { label: '来源', weight: 1, text: entry.source }
  ]

  let score = 0
  const hits = new Set()

  fields.forEach((f) => {
    const text = lower(f.text)
    if (!text) return
    tokens.forEach((t) => {
      if (text.includes(t)) {
        score += f.weight
        hits.add(f.label)
      }
    })
  })

  if (lower(entry.title).includes(lower(query))) score += 8
  if (lower(entry.subtitle).includes(lower(query))) score += 3

  return { score, hits: [...hits] }
}

export const SORTS = [
  { id: 'relevance', name: '相关度优先' },
  { id: 'updated', name: '最近更新' },
  { id: 'created', name: '最新收录' },
  { id: 'title', name: '标题排序' }
]

export const LIBRARY_SORTS = [...SORTS, { id: 'catalog', name: '图录顺序' }]

/**
 * 组合检索：关键词 + 专题 + 分类 + 标签 + 状态，多条件交集。
 * @param {Array} list 统一条目全集
 * @param {{q?:string, collection?:string, category?:string, tags?:string[], sort?:string, status?:string, withDraft?:boolean}} opts
 */
export function searchEntries(list, opts = {}) {
  const { q = '', collection = '', category = '', tags = [], sort = 'relevance', status = '' } = opts

  let result = list.slice()

  if (collection) result = result.filter((e) => e.collection === collection)
  if (category) result = result.filter((e) => e.category === category)
  if (status) result = result.filter((e) => e.status === status)

  if (tags.length) {
    result = result.filter((e) => tags.some((t) => (e.tags || []).includes(t)))
  }

  if (q.trim()) {
    result = result
      .map((e) => {
        const { score, hits } = scoreEntry(e, q)
        return { ...e, _score: score, _hits: hits }
      })
      .filter((e) => e._score > 0)
  }

  const cmp = {
    relevance: (a, b) => {
      if (q.trim()) return (b._score || 0) - (a._score || 0)
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    },
    updated: (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
    created: (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    title: (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-Hans-CN'),
    catalog: (a, b) => String(a.id).localeCompare(String(b.id))
  }[sort] || ((a, b) => (b._score || 0) - (a._score || 0))

  return result.sort(cmp)
}

/** 兼容别名：管理端沿用旧函数名 */
export const searchMaterials = searchEntries

/** 成果多维筛选：作者 + 学期 + 类型 + 关键词 */
export function filterWorks(list, opts = {}) {
  const { q = '', author = '', semester = '', type = '' } = opts
  let result = list.slice()

  if (author) result = result.filter((w) => w.author === author)
  if (semester) result = result.filter((w) => w.semester === semester)
  if (type) result = result.filter((w) => w.type === type)

  if (q.trim()) {
    const tokens = tokenize(q)
    result = result.filter((w) => {
      const text = [w.title, w.summary, w.content, w.author, w.course, w.semester, (w.tags || []).join(' ')]
        .join(' ')
        .toLowerCase()
      return tokens.some((t) => text.includes(t))
    })
  }

  return result.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

/** 汇总标签，按频次降序 */
export function collectTags(list) {
  const map = new Map()
  list.forEach((e) => (e.tags || []).forEach((t) => map.set(t, (map.get(t) || 0) + 1)))
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN'))
}

/** 按任意键计数 */
export function countBy(list, key) {
  const map = {}
  list.forEach((e) => {
    const k = typeof key === 'function' ? key(e) : e[key]
    map[k] = (map[k] || 0) + 1
  })
  return map
}
