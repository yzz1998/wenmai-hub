/**
 * 引用 / 分享 / 导出 —— 跨专题统一实现。
 *
 * 三个馆的资料来源性质不同，引用格式必须分开：
 * · 剪纸图样是「图录图版」，按图录页码引用；
 * · 畲族展项是「二次整理的展陈文本」，按展馆条目 + 原始报道引用；
 * · 知识素材是「知识库条目」，按类 GB/T 7714 的电子资源格式引用。
 * 共用的是同一套入口：buildCitation(entry, { style })。
 */
import { COLLECTION_MAP } from '../data/collections'
import { categoryName } from '../data/taxonomy'
import { SITE } from '../data/site'

const SITE_NAME = SITE.full

function collName(entry) {
  return COLLECTION_MAP[entry.collection]?.name || '文脉馆'
}

function catLabel(entry) {
  return entry.categoryLabel || categoryName(entry.collection, entry.category)
}

/** 规范引用文本 */
export function buildCitation(entry, { style = 'gbt' } = {}) {
  if (!entry) return ''
  const cat = catLabel(entry)
  const access = entry.updatedAt || entry.createdAt || ''

  if (entry.collection === 'papercut') {
    const { vol = '', page = '', size = '' } = entry.facets || {}
    if (style === 'brief') {
      return [
        `《${entry.title}》`,
        `类别：${cat}`,
        vol && `册次：${vol}册`,
        page && `页码：p.${page}`,
        size && `图版：${size}`,
        '来源：《剪花娘子》图录'
      ]
        .filter(Boolean)
        .join('　|　')
    }
    return [
      `库淑兰. ${entry.title}[图版]. 见：《剪花娘子》${vol}册. 第 ${page} 页.`,
      `${collName(entry)}, ${access}.`,
      `类别：${cat}.`,
      size ? `图版尺寸：${size}.` : ''
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (entry.collection === 'she') {
    if (style === 'brief') {
      return [
        `《${entry.title}》`,
        `展区：${cat}`,
        entry.source && `来源：${entry.source}`,
        entry.sourceUrl && `链接：${entry.sourceUrl}`,
        access && `收录日期：${access}`
      ]
        .filter(Boolean)
        .join('　|　')
    }
    return [
      `${entry.title}[EB/OL]. ${collName(entry)}, ${access}.`,
      `展区：${cat}.`,
      entry.source ? `来源：${entry.source}.` : '',
      entry.sourceUrl ? `获取地址：${entry.sourceUrl}` : ''
    ]
      .filter(Boolean)
      .join(' ')
  }

  /* 课程章节库：按教材章节 + 要点的形式引用，便于写进教案与作业 */
  if (COLLECTION_MAP[entry.collection]?.kind === 'course') {
    const f = entry.facets || {}
    if (style === 'brief') {
      return [
        `《${entry.title}》`,
        `位置：${f.chapter || ''}${f.section || ''}${f.kp ? `·${f.kp}` : ''}`,
        `教材：${entry.source || ''}`,
        `平台收录：${access}`
      ]
        .filter(Boolean)
        .join('　|　')
    }
    return [
      `${entry.title}[EB/OL]. 见：${f.chapter || ''}${f.section || ''}「${f.sectionTitle || cat}」.`,
      `${entry.source || ''}.`,
      `${collName(entry)}, ${access}.`,
      `要点位置：${f.kp || '—'}.`
    ]
      .filter(Boolean)
      .join(' ')
  }

  /* 知识素材 */
  if (style === 'brief') {
    return [
      `《${entry.title}》`,
      `类别：${cat}`,
      entry.region ? `地域：${entry.region}` : '',
      entry.level ? `非遗级别：${entry.level}` : '',
      `来源：${entry.source}`,
      entry.sourceUrl ? `链接：${entry.sourceUrl}` : '',
      access ? `知识库收录日期：${access}` : ''
    ]
      .filter(Boolean)
      .join('　|　')
  }
  return [
    `${entry.title}[EB/OL]. ${collName(entry)}, ${access}.`,
    `类别：${cat}.`,
    entry.region ? `地域：${entry.region}.` : '',
    entry.level ? `保护级别：${entry.level}.` : '',
    `来源：${entry.source}.`,
    entry.sourceUrl ? `获取地址：${entry.sourceUrl}` : ''
  ]
    .filter(Boolean)
    .join(' ')
}

/** 可分享深链 —— HashRouter 下用 hash 承载路由，静态托管与 file:// 均可直接跳转 */
export function buildShareLink(entry) {
  const base = `${window.location.origin}${window.location.pathname}`
  const params = new URLSearchParams()
  params.set('m', entry.id)
  if (entry.updatedAt) params.set('v', String(entry.updatedAt).replace(/-/g, ''))
  return `${base}#/entry/${entry.id}?${params.toString()}`
}

/** 复制到剪贴板，兼容非安全上下文（file:// 场景必需） */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 降级到 execCommand */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, ta.value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** 导出为可下载文本（备课时常用的兜底能力） */
export function downloadText(filename, text) {
  try {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  } catch {
    return false
  }
}

/** 单条条目导出为 Markdown */
export function buildExportText(entry) {
  if (!entry) return ''
  const cat = catLabel(entry)
  const lines = [
    `# ${entry.title}`,
    '',
    `- 所属专题：${collName(entry)}`,
    `- 分类：${cat}`,
    entry.subtitle ? `- 副题：${entry.subtitle}` : '',
    entry.region ? `- 地域：${entry.region}` : '',
    entry.era ? `- 年代：${entry.era}` : '',
    entry.level ? `- 级别：${entry.level}` : '',
    entry.tags?.length ? `- 标签：${entry.tags.join('、')}` : '',
    `- 条目编号：${entry.id}`,
    entry.updatedAt ? `- 更新日期：${entry.updatedAt}` : '',
    '',
    '## 简介',
    entry.summary || '',
    '',
    '## 详情',
    ...(entry.body || []),
    '',
    '## 来源说明',
    entry.source || '',
    entry.sourceUrl ? `链接：${entry.sourceUrl}` : '',
    '',
    '---',
    `引用：${buildCitation(entry)}`,
    `条目地址：${buildShareLink(entry)}`,
    `平台：${SITE_NAME}`
  ]
  return lines.filter((l) => l !== '' || l === '').join('\n')
}

/** 选辑（多条目）导出为 Markdown 教案素材包 */
export function buildSelectionText(entries) {
  const head = [
    '# 教学选辑',
    '',
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    `条目数：${entries.length}`,
    ''
  ]
  const body = entries.map((e, i) => {
    const cat = catLabel(e)
    return [
      `## ${i + 1}. ${e.title}`,
      '',
      `> ${COLLECTION_MAP[e.collection]?.short || ''} · ${cat}`,
      '',
      e.summary || '',
      '',
      '引用：' + buildCitation(e),
      `地址：${buildShareLink(e)}`,
      ''
    ].join('\n')
  })
  return [...head, ...body].join('\n')
}
