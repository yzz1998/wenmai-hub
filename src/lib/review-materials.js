/**
 * 待评材料采集。
 *
 * 需求是「点按钮就评当前这一页展示的东西，别再让我传一遍」。
 * 所以这里不问用户要文件，而是把详情页已经在展示的东西全部收拢：
 *
 *   1) 正文 `work.content` —— 详情页「作品正文」那几段；
 *   2) 文档 `work.docs[]` —— IndexedDB 里的解析文本，详情页「成果文档」卡；
 *   3) 图片 —— 封面、附件图、正文内嵌图；
 *   4) 音视频 / 外链 —— 模型读不了，但不能装作没看见：
 *      清单里照实列出，并在评阅提示里写明「此部分未纳入依据」。
 *
 * 两个刻意的取舍：
 *
 * - **正文与文档去重**。学生上传了 DOCX 又粘了一遍正文时，两份内容几乎一样，
 *   全送进去会让「篇幅与深度」这一维被重复计数。
 * - **图片默认只送元数据，不送像素**。DeepSeek 的 chat 模型不吃图，
 *   硬塞 base64 只会让请求失败。要真正「看图」，得在设置里打开视觉能力并换成支持视觉的模型。
 *   默认路径下，图片仍会以「配图清单 + 是否标注图注」的形式参与评分（规范维会看这个）。
 */

import { readDocText } from './docs'
import { resolveImageSrc, compressImage } from './images'

const MAX_TEXT_CHARS = 30000
const MAX_IMAGES = 4
/** 正文里出现「图 1」「如图」「上图」这类指代，说明作者有意识地在引用配图 */
const FIG_REF_RE = /图\s*[0-9一二三四五六七八九十]|如[上下]?图|见[上下]?图|示意图|配图/

const norm = (s) => String(s || '').replace(/\s/g, '')

/** 从正文里刨出 markdown / html 内嵌图，多数成果没有，但成本极低 */
function inlineImages(text) {
  const out = []
  const md = /!\[([^\]]*)\]\(([^)\s]+)\)/g
  const html = /<img[^>]+src=["']([^"']+)["']/gi
  let m
  while ((m = md.exec(text))) out.push({ src: m[2], alt: m[1] })
  while ((m = html.exec(text))) out.push({ src: m[1], alt: '' })
  return out
}

function roleLabel(role) {
  return { cover: '封面图', attachment: '附件图', inline: '正文插图' }[role] || '配图'
}

/**
 * @param {object} work
 * @param {{vision?: boolean, maxImages?: number, onProgress?: (step: string, detail?: object) => void}} opts
 * @returns {Promise<{text, chars, truncated, materials, visionParts, summary, isEmpty}>}
 */
export async function collectReviewMaterials(work, opts = {}) {
  const { vision = false, maxImages = MAX_IMAGES, onProgress = () => {} } = opts
  const docs = Array.isArray(work?.docs) ? work.docs : []

  /* ---------- 1. 文档解析文本 ---------- */
  onProgress('docs', { total: docs.length })
  const docMeta = []
  const docTexts = []
  for (const doc of docs) {
    let text = ''
    try {
      text = await readDocText(doc)
    } catch {
      text = ''
    }
    const body = String(text || '').trim()
    docMeta.push({
      name: doc.name || '未命名文档',
      kind: String(doc.kind || '').toLowerCase(),
      chars: Number(doc.chars) || norm(body).length,
      pages: Number(doc.pages) || 0,
      truncated: Boolean(doc.truncated),
      empty: !body
    })
    if (body) docTexts.push(body)
  }

  /* ---------- 2. 正文与文档合并去重 ---------- */
  const body = String(work?.content || '').trim()
  const docJoined = docTexts.join('\n\n')
  let text = docJoined
  if (body) {
    const head = norm(body).slice(0, 40)
    const duplicated = head && norm(docJoined).includes(head)
    if (!duplicated) text = docJoined ? `${docJoined}\n\n【网页正文】\n${body}` : body
  }

  let truncated = docMeta.some((d) => d.truncated)
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS)
    truncated = true
  }

  /* ---------- 3. 图片清单 ---------- */
  const figMentioned = FIG_REF_RE.test(text || body)
  const imgSrcs = []
  if (work?.image) imgSrcs.push({ value: work.image, role: 'cover', label: work.title || '封面图' })
  if (work?.type === 'image' && work?.attachedUrl) {
    imgSrcs.push({ value: work.attachedUrl, role: 'attachment', label: work.title || '作品图' })
  }
  inlineImages(work?.content || '').forEach((it, i) => {
    imgSrcs.push({ value: it.src, role: 'inline', label: it.alt || `正文插图 ${i + 1}` })
  })

  const images = []
  const visionParts = []
  for (let i = 0; i < imgSrcs.length && images.length < maxImages; i += 1) {
    const item = imgSrcs[i]
    onProgress('images', { done: i, total: Math.min(imgSrcs.length, maxImages) })
    const meta = {
      label: item.label,
      role: item.role,
      roleText: roleLabel(item.role),
      note: figMentioned ? '正文中有配图指代' : '正文未明确指代配图',
      indexed: images.length + 1
    }
    if (vision) {
      try {
        const src = await resolveImageSrc(item.value)
        if (src) {
          const out = await compressImage(src, {
            maxW: 900,
            maxH: 900,
            quality: 0.72,
            preferWebp: false // 部分兼容端点不认 webp，统一走 jpeg
          })
          visionParts.push({ dataUrl: out.dataUrl, label: meta.label })
          meta.sentAsPixels = true
        }
      } catch {
        // 跨域图片会污染 canvas，取不到像素就只送元数据，不因此中断评阅
        meta.sentAsPixels = false
      }
    }
    images.push(meta)
  }

  /* ---------- 4. 读不了的部分，如实记账 ---------- */
  const skipped = []
  if (work?.type === 'audio') skipped.push({ kind: 'audio', label: '音频作品', reason: '模型无法听取音频，仅依据文字说明评阅' })
  if (work?.type === 'video') skipped.push({ kind: 'video', label: '视频作品', reason: '模型无法播放视频，仅依据文字说明评阅' })
  const attached = String(work?.attachedUrl || '').trim()
  if (attached && work?.type === 'article') {
    skipped.push({
      kind: /^https?:/i.test(attached) ? 'link' : 'file',
      label: attached.split('/').pop() || attached,
      reason: '外部附件不在页面内展示，未纳入评阅依据'
    })
  }

  const materials = { docs: docMeta, images, skipped }
  const chars = norm(text).length

  return {
    text,
    chars,
    truncated,
    materials,
    visionParts,
    isEmpty: chars === 0,
    summary: {
      chars,
      docCount: docMeta.filter((d) => !d.empty).length,
      docNames: docMeta.map((d) => d.name),
      imageCount: images.length,
      imagePixels: visionParts.length,
      skippedCount: skipped.length,
      label: summarise({ chars, docs: docMeta, images, skipped })
    }
  }
}

/** 一行摘要，给面板和评阅记录用（不塞 base64） */
export function summarise({ chars = 0, docs = [], images = [], skipped = [] }) {
  const parts = [`正文 ${chars.toLocaleString('zh-CN')} 字`]
  if (docs.length) parts.push(`文档 ${docs.length} 份`)
  if (images.length) parts.push(`配图 ${images.length} 张`)
  if (skipped.length) parts.push(`未纳入 ${skipped.length} 项`)
  return parts.join(' · ')
}

/**
 * 不读 IndexedDB 的轻量预览：列表/详情首屏先给用户看「会评什么」，
 * 真点评阅时才走 collectReviewMaterials 去取正文与图片。
 */
export function previewMaterials(work) {
  const docs = Array.isArray(work?.docs) ? work.docs : []
  const docChars = docs.reduce((s, d) => s + (Number(d.chars) || 0), 0)
  const bodyChars = norm(work?.content || '').length
  const chars = Math.max(docChars, bodyChars)
  const imageCount =
    (work?.image ? 1 : 0) +
    (work?.type === 'image' && work?.attachedUrl ? 1 : 0) +
    inlineImages(work?.content || '').length
  const skipped = []
  if (work?.type === 'audio') skipped.push({ kind: 'audio', label: '音频作品' })
  if (work?.type === 'video') skipped.push({ kind: 'video', label: '视频作品' })
  return {
    chars,
    docCount: docs.length,
    imageCount,
    skippedCount: skipped.length,
    hasDocs: docs.length > 0,
    label: summarise({ chars, docs, images: Array(imageCount), skipped })
  }
}
