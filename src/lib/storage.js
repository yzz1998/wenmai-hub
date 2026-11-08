/**
 * 本地持久化 —— 全站只用一个 key 前缀，并兼容迁移旧知识库数据。
 *
 * 为什么不用后端：三个原项目都是纯前端离线形态，合并后保持同样约束
 * （双击即开、可静态托管、无账号体系），教学场景下更可靠。
 */
import { SEED_MATERIALS, SEED_WORKS } from '../data'

const PREFIX = 'wenmai'
export const KEY_M = `${PREFIX}.materials.v1`
export const KEY_W = `${PREFIX}.works.v1`
export const KEY_S = `${PREFIX}.selection.v1`
export const KEY_META = `${PREFIX}.meta.v1`
/** AI 评阅结果：以 workId 为键的对象表，与成果记录分开存（评阅可重算、可缺失，不该拖着整份 works 重写） */
export const KEY_R = `${PREFIX}.reviews.v1`

/** 上一代（单馆知识库）的 key，仅用于一次性迁移 */
const LEGACY = { m: 'mdkb.materials.v1', w: 'mdkb.works.v1' }

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

/** 读对象表（评阅结果是 Record，不是数组，不能复用上面的 read） */
const readObj = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** 旧数据补 collection 字段，保证统一模型不因迁移而残缺 */
function migrate(list) {
  if (!Array.isArray(list)) return null
  return list.map((m) => (m && !m.collection ? { ...m, collection: 'mindong' } : m))
}

export function loadMaterials() {
  const own = read(KEY_M, null)
  if (own) return own
  const legacy = read(LEGACY.m, null)
  if (legacy) return migrate(legacy)
  return SEED_MATERIALS
}

export const saveMaterials = (list) => write(KEY_M, list)

/** 老数据没有 docs 字段，读入时补空数组，避免各处写 `work.docs?.[0]` 之外还要判空 */
export function normalizeWork(w) {
  if (!w || typeof w !== 'object') return w
  return Array.isArray(w.docs) ? w : { ...w, docs: [] }
}

export function loadWorks() {
  const own = read(KEY_W, null)
  if (own) return own.map(normalizeWork)
  const legacy = read(LEGACY.w, null)
  if (legacy) return legacy.map(normalizeWork)
  return SEED_WORKS.map(normalizeWork)
}

export const saveWorks = (list) => write(KEY_W, list)

export const loadReviews = () => readObj(KEY_R, {})
export const saveReviews = (map) => write(KEY_R, map)

export const loadSelection = () => read(KEY_S, [])
export const saveSelection = (ids) => write(KEY_S, ids)

export const loadMeta = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY_META) || '{}')
  } catch {
    return {}
  }
}
export const saveMeta = (meta) => write(KEY_META, meta)

/** 生成素材编号：M-<CATEGORY>-<序号> */
export function nextMaterialId(list, categoryId) {
  const prefix = `M-${String(categoryId).toUpperCase()}-`
  const nums = list
    .filter((m) => String(m.id).startsWith(prefix))
    .map((m) => parseInt(String(m.id).slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

/** 生成成果编号：W-<年份>-<四位序号> */
export function nextWorkId(list, year) {
  const prefix = `W-${year}-`
  const nums = list
    .filter((w) => String(w.id).startsWith(prefix))
    .map((w) => parseInt(String(w.id).slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `${prefix}${String(next).padStart(4, '0')}`
}

export const todayISO = () => new Date().toISOString().slice(0, 10)
