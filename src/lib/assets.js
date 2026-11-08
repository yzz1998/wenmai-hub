/**
 * 资源路径解析。
 *
 * 全站图片一律走这里，理由：
 * 1) 数据里的历史路径有两种写法（'/img/real/x.jpg' 与 'img/she/cloth/p001.jpg'）；
 * 2) Vite 的 base 设为 './'，构建后必须是相对地址，否则 file:// 与子目录部署都会断图。
 */

const BASE = import.meta.env.BASE_URL || './'

export function asset(p) {
  if (!p) return ''
  if (/^(https?:|data:|blob:)/i.test(p)) return p
  const clean = String(p).replace(/^\.?\//, '')
  return `${BASE}${clean}`
}

/** 从 media 数组取首图（列表/卡片用） */
export function primaryMedia(entry) {
  return entry?.media?.[0] || null
}

export function primaryImage(entry) {
  const m = primaryMedia(entry)
  return m ? asset(m.src) : ''
}

/** 图片完整尺寸地址（查看器/详情大图用），没有高清则回落缩略图 */
export function fullImage(media) {
  if (!media) return ''
  return asset(media.full || media.src)
}
