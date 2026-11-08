/**
 * 配图管理内核。
 *
 * 设计约束（与项目的「零新增依赖 + 离线可用」原则一致）：
 * - 不使用任何第三方图片库，压缩靠原生 Canvas。
 * - 本地图片有两种落盘方式：
 *   1) 小图（压缩后 ≤ threshold）直接转 DataURL 存进素材记录，随 localStorage 一起持久化；
 *   2) 大图 / 原始文件存进 IndexedDB，素材记录里只保留 `local:<key>` 形式的引用，
 *      避免 localStorage 5MB 配额被单张图撑爆。
 * - 记录里保留 `imageMeta`（来源、尺寸、体积、时间），便于管理页统计与「移除配图」。
 */

const IMG_PREFIX = 'local:'
const DB_NAME = 'wenmai.images'
const DB_STORE = 'blobs'

/** DataURL 估算体积（字节）。base64 每 4 字符 3 字节 */
export function dataUrlBytes(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 0
  const i = dataUrl.indexOf(',')
  if (i < 0) return 0
  const b64 = dataUrl.slice(i + 1)
  const padding = (b64.match(/=+$/) || [''])[0].length
  return Math.floor((b64.length * 3) / 4) - padding
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

/* ------------------------------------------------------------------ */
/* IndexedDB 仓储：存放不宜进 localStorage 的大图                        */
/* ------------------------------------------------------------------ */

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前环境不支持 IndexedDB'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'))
  })
}

export async function idbPut(key, blob) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).put(blob, key)
    tx.oncomplete = () => { db.close(); resolve(key) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function idbGet(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly')
    const req = tx.objectStore(DB_STORE).get(key)
    req.onsuccess = () => { db.close(); resolve(req.result || null) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function idbDelete(key) {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite')
      tx.objectStore(DB_STORE).delete(key)
      tx.oncomplete = () => { db.close(); resolve(true) }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  } catch {
    return false
  }
}

export async function idbKeys() {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly')
      const req = tx.objectStore(DB_STORE).getAllKeys()
      req.onsuccess = () => { db.close(); resolve(req.result || []) }
      req.onerror = () => { db.close(); reject(req.error) }
    })
  } catch {
    return []
  }
}

/* ------------------------------------------------------------------ */
/* 引用解析：把 `local:<key>` 还原成可显示的 URL                          */
/* ------------------------------------------------------------------ */

export const isLocalRef = (v) => typeof v === 'string' && v.startsWith(IMG_PREFIX)
export const localKeyOf = (v) => (isLocalRef(v) ? v.slice(IMG_PREFIX.length) : '')

/** 解析为可直接放进 <img src> 的值；本地引用会按需读 IndexedDB 并转 objectURL */
export async function resolveImageSrc(value) {
  if (!value) return ''
  if (!isLocalRef(value)) return value
  const blob = await idbGet(localKeyOf(value))
  if (!blob) return ''
  return URL.createObjectURL(blob)
}

/** 同步兜底：已知是 data/http 引用时直接用，否则返回空（由调用方异步补） */
export function quickSrc(value) {
  if (!value) return ''
  return isLocalRef(value) ? '' : value
}

/* ------------------------------------------------------------------ */
/* 压缩：Canvas 缩放 + 编码为体积更小的格式                              */
/* ------------------------------------------------------------------ */

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result || ''))
    fr.onerror = () => reject(fr.error || new Error('读取文件失败'))
    fr.readAsDataURL(file)
  })
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片解析失败，请确认文件格式'))
    img.src = src
  })
}

/**
 * 压缩图片。
 * @param {File|Blob|string} input 文件、Blob 或 dataURL
 * @param {{maxW?:number,maxH?:number,quality?:number,preferWebp?:boolean}} opts
 * @returns {Promise<{dataUrl:string,width:number,height:number,bytes:number,type:string}>}
 */
export async function compressImage(input, opts = {}) {
  const { maxW = 1600, maxH = 1200, quality = 0.86, preferWebp = true } = opts

  const src = typeof input === 'string' ? input : await blobToDataURL(input)
  const img = await loadImage(src)

  let { width: w, height: h } = img
  const scale = Math.min(1, maxW / w, maxH / h)
  w = Math.max(1, Math.round(w * scale))
  h = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器不支持 Canvas 绘图，无法压缩')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // 处理透明背景：WebP 支持透明，JPEG 不支持，用白底兜底避免黑块
  const type = pickType(preferWebp)
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)

  let dataUrl = canvas.toDataURL(type, quality)
  // 极少数环境下 WebP 编码会静默退回 PNG（体积反而更大），此时改用 JPEG
  if (type === 'image/webp' && !dataUrl.startsWith('data:image/webp')) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }

  return {
    dataUrl,
    width: w,
    height: h,
    bytes: dataUrlBytes(dataUrl),
    type: dataUrl.slice(5, dataUrl.indexOf(';'))
  }
}

function pickType(preferWebp) {
  if (!preferWebp) return 'image/jpeg'
  try {
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    return c.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg'
  } catch {
    return 'image/jpeg'
  }
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result || ''))
    fr.onerror = () => reject(fr.error || new Error('读取失败'))
    fr.readAsDataURL(blob)
  })
}

/** 读取图片原始尺寸（不上传，只探测） */
export async function probeSize(src) {
  try {
    const img = await loadImage(src)
    return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height }
  } catch {
    return { width: 0, height: 0 }
  }
}

/**
 * 把一张本地图片写入素材数据。
 * 大图走 IndexedDB，返回 `local:<key>`；小图返回 DataURL。
 * @returns {Promise<{ref:string, meta:object}>}
 */
export async function persistImage(file, { maxBytes = 420 * 1024, maxW = 1600, maxH = 1200 } = {}) {
  const compressed = await compressImage(file, { maxW, maxH })
  const meta = {
    source: 'upload',
    width: compressed.width,
    height: compressed.height,
    bytes: compressed.bytes,
    type: compressed.type,
    name: file?.name || '',
    updatedAt: new Date().toISOString().slice(0, 10)
  }

  if (compressed.bytes <= maxBytes) {
    return { ref: compressed.dataUrl, meta }
  }

  // 体积超标 —— 转存 IndexedDB
  const key = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const blob = await (await fetch(compressed.dataUrl)).blob()
  await idbPut(key, blob)
  meta.storage = 'indexeddb'
  return { ref: IMG_PREFIX + key, meta }
}

/** 移除一张本地图片（若存在 IndexedDB 副本则一并清理） */
export async function discardImage(value) {
  if (isLocalRef(value)) await idbDelete(localKeyOf(value))
}

/* ------------------------------------------------------------------ */
/* 统计：供管理页展示配图覆盖情况                                        */
/* ------------------------------------------------------------------ */

export function imageStats(list) {
  const total = list.length
  let withImage = 0
  let localCount = 0
  let externalCount = 0
  let bytes = 0
  let photoCount = 0 // 实景照片 / 自备位图
  let vectorCount = 0 // 矢量插画（本库生成）

  list.forEach((m) => {
    const v = m.image
    if (!v) return
    withImage += 1
    if (isLocalRef(v)) {
      localCount += 1
      photoCount += 1
    } else if (v.startsWith('data:')) {
      bytes += dataUrlBytes(v)
      photoCount += 1
    } else {
      externalCount += 1
      // .svg 视为矢量插画，其余（jpg/png/webp 等）视为实景照片
      if (/\.svg(\?|$)/i.test(v)) vectorCount += 1
      else photoCount += 1
    }
    if (m.imageMeta?.bytes) bytes += 0
  })

  const missing = list.filter((m) => !m.image)
  return { total, withImage, missing, localCount, externalCount, bytes, photoCount, vectorCount }
}
