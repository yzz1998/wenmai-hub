/**
 * 学生成果文档解析 —— PDF / DOCX / TXT / MD → 纯文本。
 *
 * 三条设计取舍：
 *
 * 1) **前端解析，只把文本发出去**。EdgeOne 云函数的请求体上限是 6MB、墙钟 120s，
 *    把 20MB 的 PDF 原文件传给函数既超限也没必要。这里在浏览器里解析，
 *    上游只收到 3 万字以内的纯文本（≈90KB）。
 *
 * 2) **解析库动态 import**。pdfjs-dist 与 mammoth 合计 gzip 后近 1MB，
 *    静态 import 会让首屏包体翻倍。两处都用 `await import(...)`，Vite 自动拆 chunk，
 *    没上传过文档的用户根本不会加载它们。
 *
 * 3) **文本与原件分两个 key 存 IndexedDB**，成果记录里只留 `local:<id>:text` 这类引用。
 *    localStorage 只有 5MB，而 `useStore` 每次改动都会重写整个 works 数组，
 *    把几万字正文塞进记录里迟早撑爆配额（且写失败是静默的）。
 */

import { idbPut, idbGet, idbDelete, idbAvailable } from './idb'
import { formatBytes } from './images'

export const DOC_ACCEPT = '.pdf,.docx,.txt,.md,.markdown'

const DB_NAME = 'wenmai.docs'
const DB_STORE = 'blobs'
const DOC_PREFIX = 'local:'

/** 上限：超过体积直接拒绝；超过页数/字数做截断而不是报错 */
export const DOC_LIMITS = {
  mb: { pdf: 20, docx: 10, txt: 5, md: 5 },
  maxPages: 80,
  maxChars: 30000,
  minChars: 300,
  parseTimeoutMs: 30000,
  /** 原件超过这个体积就不存（只保留解析文本），避免 IndexedDB 被几份 PDF 塞满 */
  keepRawMaxBytes: 10 * 1024 * 1024
}

const KIND_BY_EXT = {
  pdf: 'pdf',
  docx: 'docx',
  txt: 'txt',
  md: 'md',
  markdown: 'md'
}

const MIME_BY_KIND = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown'
}

/* ------------------------------------------------------------------ */
/* 错误类型与文案                                                       */
/* ------------------------------------------------------------------ */

export class DocError extends Error {
  constructor(code, detail = '') {
    super(DOC_ERROR_COPY[code]?.title || '文档处理失败')
    this.name = 'DocError'
    this.code = code
    this.detail = detail
  }
}

/**
 * 每一条都必须回答三个问题：出了什么事、为什么、下一步点哪里。
 * 文案集中在这里，DocField 只负责渲染，不散落字符串。
 */
export const DOC_ERROR_COPY = {
  INVALID_EXT: {
    title: '不支持该格式',
    desc: (d) => `请上传 PDF、DOCX、TXT 或 MD 文件${d ? `（当前：${d}）` : ''}。`,
    action: '重新选择',
    recoverable: true
  },
  LEGACY_OFFICE: {
    title: '暂不支持旧版 Word 文档',
    desc: () =>
      '检测到 .doc / .wps 格式。请用 Word 或 WPS 打开该文件，选择「另存为」→ 文件类型选「Word 文档 (*.docx)」，再上传新文件。',
    action: '另存为 .docx 后重传',
    recoverable: true
  },
  MISLABELED: {
    title: '文件后缀与实际格式不符',
    desc: () =>
      '这个文件只是把后缀改成了 .docx，内容仍是旧版 Word（.doc）。请用 Word 打开后「另存为」真正的 .docx，或导出为 PDF。',
    action: '另存为 .docx 后重传',
    recoverable: true
  },
  EMPTY_FILE: {
    title: '这是一个空文件',
    desc: () => '文件体积为 0 字节，没有可解析的内容。',
    action: '重新选择',
    recoverable: true
  },
  TOO_LARGE: {
    title: '文件超过体积上限',
    desc: (d) =>
      `PDF 最大 20MB、DOCX 最大 10MB、TXT/MD 最大 5MB${d ? `，当前 ${d}` : ''}。可先压缩文档内的图片，或拆成两份分别上传。`,
    action: '压缩或拆分后重传',
    recoverable: true
  },
  ENCRYPTED: {
    title: 'PDF 设有打开密码',
    desc: () =>
      '无法读取加密文档的正文。请先用密码打开，再「打印」→「另存为 PDF」生成一份无密码副本后上传。',
    action: '去密码另存后重传',
    recoverable: true
  },
  NO_TEXT_LAYER: {
    title: '这份 PDF 没有文字层',
    desc: () =>
      '它看起来是扫描件或纯图片 PDF，只能看到图像、读不出文字。可以先用 OCR 识别后把正文粘贴到「正文」框，或改传 DOCX。',
    action: '改用正文 / 换 DOCX',
    recoverable: true
  },
  TOO_SHORT: {
    title: '解析到的正文太短',
    desc: (d) => `只提取到 ${d}，不足以用于评阅。请确认文档内容完整。`,
    action: '换一份文档',
    recoverable: true
  },
  PARSE_FAILED: {
    title: '文件解析失败',
    desc: () => '文件可能已损坏或不是标准格式。请用原软件重新导出后再试。',
    action: '重新导出后重传',
    recoverable: true
  },
  TIMEOUT: {
    title: '解析超时',
    desc: () => '超过 30 秒仍未解析完成，文档可能过大或页数过多。建议拆分后分别上传。',
    action: '拆分后重传',
    recoverable: true
  },
  OFFLINE_UNSUPPORTED: {
    title: '当前打开方式无法解析文档',
    desc: () =>
      '以本地文件（file://）方式打开时，浏览器禁止加载 PDF 解析组件。请改用部署地址访问本站，或上传 TXT / MD 文件。',
    action: '改用线上地址',
    recoverable: false
  },
  IDB_UNAVAILABLE: {
    title: '浏览器本地存储不可用',
    desc: () =>
      '可能处于无痕/隐私模式，或站点存储被禁用，文档无法保存。可以改为把正文直接粘贴到「正文」框。',
    action: '改用正文粘贴',
    recoverable: false
  }
}

export function docErrorText(code, detail = '') {
  const c = DOC_ERROR_COPY[code] || DOC_ERROR_COPY.PARSE_FAILED
  return {
    title: c.title,
    desc: typeof c.desc === 'function' ? c.desc(detail) : c.desc,
    action: c.action,
    recoverable: c.recoverable
  }
}

/* ------------------------------------------------------------------ */
/* 格式探测                                                             */
/* ------------------------------------------------------------------ */

const extOf = (name = '') => {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

/** 读前 8 字节判断真实容器格式，防「改后缀冒充」 */
async function sniff(file) {
  try {
    const buf = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    const hex = [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
    if (hex.startsWith('25504446')) return 'pdf' // %PDF
    if (hex.startsWith('504b0304')) return 'zip' // docx 是 zip 容器
    if (hex.startsWith('d0cf11e0')) return 'ole' // 旧版 Office（doc/xls/wps）
    return 'other'
  } catch {
    return 'unknown'
  }
}

/**
 * 只做可行性判断，不解析。选完文件立刻能给反馈。
 * @returns {Promise<{kind:'pdf'|'docx'|'txt'|'md', ext:string, bytes:number}>}
 */
export async function inspectFile(file) {
  if (!file) throw new DocError('EMPTY_FILE')
  const ext = extOf(file.name)
  const size = Number(file.size) || 0

  if (ext === 'doc' || ext === 'wps') throw new DocError('LEGACY_OFFICE')
  const kind = KIND_BY_EXT[ext]
  if (!kind) throw new DocError('INVALID_EXT', ext ? `.${ext}` : '无后缀')

  if (size === 0) throw new DocError('EMPTY_FILE')
  const limit = (DOC_LIMITS.mb[kind] || 5) * 1024 * 1024
  if (size > limit) throw new DocError('TOO_LARGE', formatBytes(size))

  const magic = await sniff(file)
  if (magic === 'ole') throw new DocError('MISLABELED')
  if (kind === 'pdf' && magic !== 'pdf') throw new DocError('MISLABELED')
  if (kind === 'docx' && magic !== 'zip') throw new DocError('MISLABELED')

  return { kind, ext, bytes: size }
}

/* ------------------------------------------------------------------ */
/* 文本清洗                                                             */
/* ------------------------------------------------------------------ */

/** 去 BOM、统一换行、压缩连续空行、去行尾空白 */
export function normalizeText(raw) {
  return String(raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00a0]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Markdown → 纯文本（保留段落，去掉标记） */
export function mdToText(raw) {
  return normalizeText(
    String(raw || '')
      .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[^\n]*\n?/g, '').replace(/```/g, ''))
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/^\s*([-*_]\s*){3,}$/gm, '')
      .replace(/<[^>]+>/g, '')
  )
}

/** 按 UTF-8 解码；出现大量替换字符（U+FFFD）时回落 GB18030，兼容老的中文 txt */
function decodeText(buffer) {
  let s = ''
  try {
    s = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  } catch {
    s = ''
  }
  const bad = (s.match(/\uFFFD/g) || []).length
  if (!s || bad > Math.max(3, s.length * 0.003)) {
    try {
      const alt = new TextDecoder('gb18030', { fatal: false }).decode(buffer)
      if (alt && (alt.match(/\uFFFD/g) || []).length < bad) s = alt
    } catch {
      /* 浏览器不支持 gb18030 时保持 UTF-8 结果 */
    }
  }
  return s
}

/* ------------------------------------------------------------------ */
/* 各格式解析                                                           */
/* ------------------------------------------------------------------ */

/** PDF 文本项按基线聚成行，再按 x 排序拼回阅读顺序 */
function assemblePdfLines(items) {
  const rows = []
  items.forEach((it) => {
    const str = it.str
    if (!str || !str.trim()) return
    const y = Number(it.transform?.[5]) || 0
    const x = Number(it.transform?.[4]) || 0
    let row = rows.find((r) => Math.abs(r.y - y) <= 2.5)
    if (!row) {
      row = { y, cells: [] }
      rows.push(row)
    }
    row.cells.push({ x, str })
  })
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) =>
      r.cells
        .sort((a, b) => a.x - b.x)
        .map((c) => c.str)
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .join('\n')
}

function withTimeout(promise, ms, onTimeout) {
  let timer
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try {
        onTimeout && onTimeout()
      } catch {
        /* 中断本身的异常忽略 */
      }
      reject(new DocError('TIMEOUT'))
    }, ms)
  })
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer))
}

async function parsePdf(file, { onProgress } = {}) {
  if (typeof location !== 'undefined' && location.protocol === 'file:') {
    throw new DocError('OFFLINE_UNSUPPORTED')
  }
  let pdfjs
  let workerUrl
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const w = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    workerUrl = w.default
  } catch (e) {
    throw new DocError('OFFLINE_UNSUPPORTED')
  }
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const data = new Uint8Array(await file.arrayBuffer())
  let task
  try {
    task = pdfjs.getDocument({
      data,
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      useWorkerFetch: false
    })
  } catch {
    throw new DocError('PARSE_FAILED')
  }

  let pdf
  try {
    pdf = await withTimeout(task.promise, DOC_LIMITS.parseTimeoutMs, () => task.destroy())
  } catch (e) {
    if (e instanceof DocError) throw e
    const name = e?.name || ''
    if (name === 'PasswordException') throw new DocError('ENCRYPTED')
    throw new DocError('PARSE_FAILED')
  }

  const total = pdf.numPages
  const pages = Math.min(total, DOC_LIMITS.maxPages)
  const chunks = []
  let chars = 0
  let truncated = total > pages

  try {
    for (let i = 1; i <= pages; i += 1) {
      onProgress && onProgress({ stage: 'parsing', pct: Math.round((i / pages) * 100), page: i, pages })
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const text = assemblePdfLines(content.items || [])
      page.cleanup()
      if (text) {
        chunks.push(text)
        chars += text.length
      }
      if (chars >= DOC_LIMITS.maxChars) {
        truncated = true
        break
      }
    }
  } catch (e) {
    throw new DocError('PARSE_FAILED')
  } finally {
    try {
      await task.destroy()
    } catch {
      /* 已销毁 */
    }
  }

  return { text: chunks.join('\n\n'), pages: total, truncated }
}

async function parseDocx(file) {
  let mammoth
  try {
    // mammoth 主包是 CJS，Vite 预构建通常可用；失败时下面的浏览器版兜底
    mammoth = (await import('mammoth')).default || (await import('mammoth'))
  } catch {
    mammoth = await import('mammoth/mammoth.browser.min.js')
  }
  const api = mammoth.default || mammoth
  try {
    const { value } = await api.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return { text: value || '', truncated: false }
  } catch {
    throw new DocError('PARSE_FAILED')
  }
}

async function parsePlain(file, kind) {
  const buffer = await file.arrayBuffer()
  const raw = decodeText(buffer)
  return { text: kind === 'md' ? mdToText(raw) : raw, truncated: false }
}

/** 在换行处截断，尽量不切在句中断 */
function clipText(text, max) {
  if (text.length <= max) return { text, truncated: false }
  const head = text.slice(0, max)
  const cut = Math.max(head.lastIndexOf('\n\n'), head.lastIndexOf('。'), head.lastIndexOf('\n'))
  return { text: (cut > max * 0.8 ? head.slice(0, cut + 1) : head).trim(), truncated: true }
}

/* ------------------------------------------------------------------ */
/* 对外主入口                                                           */
/* ------------------------------------------------------------------ */

const newDocId = () => `D-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/**
 * 解析文档并落盘。
 * @returns {Promise<{doc: object, text: string}>}
 */
export async function parseDocument(file, { onProgress, keepOriginal = true } = {}) {
  const info = await inspectFile(file)
  if (!idbAvailable()) throw new DocError('IDB_UNAVAILABLE')

  onProgress && onProgress({ stage: 'reading', pct: 5 })

  let parsed
  if (info.kind === 'pdf') parsed = await parsePdf(file, { onProgress })
  else if (info.kind === 'docx') parsed = await parseDocx(file)
  else parsed = await parsePlain(file, info.kind)

  let text = normalizeText(parsed.text)
  const rawChars = text.replace(/\s/g, '').length

  if (rawChars < DOC_LIMITS.minChars) {
    // 扫描件 PDF 与「txt 写得太短」是两回事：前者要引导去 OCR/换格式，
    // 后者只是内容不够，文案不能混用同一句「这份 PDF 没有文字层」。
    throw info.kind === 'pdf'
      ? new DocError('NO_TEXT_LAYER', `约 ${rawChars} 字`)
      : new DocError('TOO_SHORT', `约 ${rawChars} 字`)
  }

  const clipped = clipText(text, DOC_LIMITS.maxChars)
  text = clipped.text

  onProgress && onProgress({ stage: 'persisting', pct: 92 })

  const id = newDocId()
  const textRef = `${DOC_PREFIX}${id}:text`
  const textBlob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  try {
    await idbPut(DB_NAME, DB_STORE, `${id}:text`, textBlob)
  } catch {
    throw new DocError('IDB_UNAVAILABLE')
  }

  let fileRef = ''
  const keepRaw = keepOriginal && info.bytes <= DOC_LIMITS.keepRawMaxBytes
  if (keepRaw) {
    try {
      await idbPut(DB_NAME, DB_STORE, `${id}:raw`, file.slice(0, file.size, file.type || MIME_BY_KIND[info.kind]))
      fileRef = `${DOC_PREFIX}${id}:raw`
    } catch {
      /* 原件存不下不致命，文本已经在，评阅照常 */
      fileRef = ''
    }
  }

  onProgress && onProgress({ stage: 'persisting', pct: 100 })

  const doc = {
    id,
    name: file.name || `未命名.${info.ext}`,
    kind: info.kind,
    mime: file.type || MIME_BY_KIND[info.kind],
    bytes: info.bytes,
    pages: parsed.pages,
    chars: text.length,
    truncated: Boolean(parsed.truncated || clipped.truncated),
    parser: info.kind === 'pdf' ? 'pdfjs' : info.kind === 'docx' ? 'mammoth' : 'plain',
    textRef,
    fileRef: fileRef || undefined,
    textPreview: text.slice(0, 120),
    parsedAt: new Date().toISOString()
  }

  return { doc, text }
}

/** 读取解析文本；引用失效时返回空串而不是抛错（详情页要能降级） */
export async function readDocText(doc) {
  if (!doc || !doc.textRef) return ''
  const key = String(doc.textRef).startsWith(DOC_PREFIX)
    ? String(doc.textRef).slice(DOC_PREFIX.length)
    : String(doc.textRef)
  try {
    const blob = await idbGet(DB_NAME, DB_STORE, key)
    if (!blob) return ''
    return await blob.text()
  } catch {
    return ''
  }
}

/** 读取原件 Blob（下载/重解析用） */
export async function readDocFile(doc) {
  if (!doc || !doc.fileRef) return null
  const key = String(doc.fileRef).startsWith(DOC_PREFIX)
    ? String(doc.fileRef).slice(DOC_PREFIX.length)
    : String(doc.fileRef)
  try {
    return (await idbGet(DB_NAME, DB_STORE, key)) || null
  } catch {
    return null
  }
}

/** 删除一批文档的全部落盘内容（成果被删时级联调用） */
export async function discardWorkDocs(docs = []) {
  const list = Array.isArray(docs) ? docs : []
  await Promise.all(
    list.flatMap((d) => {
      if (!d || !d.id) return []
      return [idbDelete(DB_NAME, DB_STORE, `${d.id}:text`), idbDelete(DB_NAME, DB_STORE, `${d.id}:raw`)]
    })
  )
}

export const isDocRef = (v) => typeof v === 'string' && v.startsWith(DOC_PREFIX)
