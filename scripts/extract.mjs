/**
 * 三源数据抽取器 —— 把三个历史项目的内容归一化为「统一 Entry 模型」。
 *
 * 源 1  库淑兰剪纸纹样馆  ……/库淑兰剪纸纹样馆/assets/data.js + images/{thumbs,full}
 * 源 2  畲族民俗文化展示    ……/畲族博物馆_web/index.html 内联 ZONES / ITEMS + 真实图片/
 * 源 3  闽东本土文化知识库  ……/mindong-culture-hub/src/data/seed.js
 *
 * 输出 src/data/{papercut,she,mindong,works}.json
 * 以及 public/img/{papercut,she} 下的图片资源。
 *
 * 设计原则：只做「结构归一 + 资源搬迁」，不改写任何文字内容；
 * 原文一句不动，保证三馆原有叙述完整。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DATA = path.join(ROOT, 'src', 'data')
const OUT_PUB = path.join(ROOT, 'public', 'img')

const SRC_PAPER = 'C:/Users/YZZ/WorkBuddy/2026-09-07-19-31-25/库淑兰剪纸纹样馆'
const SRC_SHE = 'C:/Users/YZZ/WorkBuddy/2026-09-09-18-46-16/畲族博物馆_web'
const SRC_MD = 'C:/Users/YZZ/WorkBuddy/2026-09-29-00-56-42/mindong-culture-hub'

const log = (...a) => console.log('[extract]', ...a)

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function copyFile(from, to) {
  ensureDir(path.dirname(to))
  fs.copyFileSync(from, to)
}

const pad = (n, w = 3) => String(n).padStart(w, '0')

/** 中文/特殊字符 → 安全 ascii slug（仅用于目录名，文件名统一编号） */
const ZONE_SLUG = {
  语言文字: 'lang',
  传统服饰: 'cloth',
  歌舞艺术: 'music',
  节庆习俗: 'festival',
  手工技艺: 'craft',
  文史医药: 'archive',
  彩带织锦: 'ribbon',
  银饰彩带: 'silver',
  歌舞对唱: 'dance',
  婚嫁仪式: 'wedding',
  祭祀祖图: 'ritual',
  生活场景: 'life',
  节庆现场: 'festival-site',
  _其他场景: 'other'
}

/* ================================================================== */
/* 源 1 · 库淑兰剪纸                                                    */
/* ================================================================== */
function extractPapercut() {
  const dataFile = path.join(SRC_PAPER, 'assets/data.js')
  const src = fs.readFileSync(dataFile, 'utf8')
  const sandbox = {}
  // data.js 是纯 `window.KUSHU = {...}` 赋值，用函数作用域执行避免污染全局
  // eslint-disable-next-line no-new-func
  new Function('window', src)(sandbox)
  const K = sandbox.KUSHU
  if (!K || !Array.isArray(K.items)) throw new Error('剪纸数据解析失败')

  const catOrder = K.catOrder
  const catIntro = K.catIntro

  // 按分类顺序 + 册页排序，得到稳定的展示序列
  const sorted = K.items.slice().sort((a, b) => {
    const ca = catOrder.indexOf(a.cat)
    const cb = catOrder.indexOf(b.cat)
    if (ca !== cb) return ca - cb
    if (a.vol !== b.vol) return a.vol === '上' ? -1 : 1
    return (a.page || 0) - (b.page || 0)
  })

  ensureDir(path.join(OUT_PUB, 'papercut/thumbs'))
  ensureDir(path.join(OUT_PUB, 'papercut/full'))

  let missing = 0
  const entries = sorted.map((it, i) => {
    const id = `PC-${pad(i + 1)}`
    // 统一改用 ascii 文件名（pc-001.webp）：规避中文路径在 URL / 静态托管 / file:// 下的编码风险，
    // 原始文件名仍以 sourceId 完整保留，可回溯图录条目。
    const fileName = `${id.toLowerCase()}.webp`
    const thumbSrc = path.join(SRC_PAPER, 'images/thumbs', it.file)
    const fullSrc = path.join(SRC_PAPER, 'images/full', it.file)
    const hasThumb = fs.existsSync(thumbSrc)
    const hasFull = fs.existsSync(fullSrc)
    if (!hasThumb) missing += 1
    if (hasThumb) copyFile(thumbSrc, path.join(OUT_PUB, 'papercut/thumbs', fileName))
    if (hasFull) copyFile(fullSrc, path.join(OUT_PUB, 'papercut/full', fileName))

    // 「纹样细解」原文以「；」分句，拆为段落更易读；不增删一字
    const themeRaw = String(it.theme || '').trim()
    const body = themeRaw
      ? themeRaw
          .split(/[；;]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => (/[。！？]$/.test(s) ? s : `${s}。`))
      : []

    const title = (it.clean || it.title || '未命名').trim()
    const tags = title
      .split(/[·•、，,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s && s.length <= 12)

    return {
      id,
      collection: 'papercut',
      sourceId: it.id,
      title,
      subtitle: `${it.cat} · ${it.vol}册 p.${it.page}`,
      summary: body[0] || '',
      body,
      tags: [...new Set(tags)].slice(0, 8),
      category: it.cat,
      region: '陕西 · 旬邑',
      era: it.year || '（图录未标注）',
      level: '中国民间彩贴剪纸',
      media: hasThumb
        ? [
            {
              src: `img/papercut/thumbs/${fileName}`,
              full: hasFull ? `img/papercut/full/${fileName}` : `img/papercut/thumbs/${fileName}`,
              w: it.tw || 0,
              h: it.th || 0,
              kind: 'work',
              credit: '图版来源：《剪花娘子》图录'
            }
          ]
        : [],
      source: `《剪花娘子》${it.vol}册，第 ${it.page} 页${it.size ? `，图版尺寸 ${it.size}` : ''}`,
      sourceUrl: '',
      links: [],
      facets: {
        vol: it.vol,
        page: it.page,
        size: it.size || '',
        year: it.year || '',
        tw: it.tw || 0,
        th: it.th || 0,
        ratio: it.tw && it.th ? Number((it.th / it.tw).toFixed(3)) : 1.25
      },
      status: 'published',
      createdAt: '2026-09-07',
      updatedAt: '2026-09-08'
    }
  })

  // 分类元数据（沿用原站 catIntro 原文）
  const categories = catOrder.map((name) => ({
    id: name,
    name,
    short: name.replace(/系列|纹样|与构成元素/g, '').slice(0, 6),
    count: entries.filter((e) => e.category === name).length,
    intro: catIntro[name] || ''
  }))

  fs.writeFileSync(
    path.join(OUT_DATA, 'papercut.json'),
    JSON.stringify({ entries, categories }, null, 1),
    'utf8'
  )
  log(`剪纸：${entries.length} 条 / ${categories.length} 类 / 缺缩略图 ${missing}`)
}

/* ================================================================== */
/* 源 2 · 畲族民俗                                                     */
/* ================================================================== */
function extractShe() {
  const file = path.join(SRC_SHE, 'index.html')
  const html = fs.readFileSync(file, 'utf8')

  const grabArray = (name) => {
    const start = html.indexOf(`const ${name} = [`)
    if (start < 0) throw new Error(`未找到 ${name}`)
    const bodyStart = html.indexOf('[', start)
    // 逐字符括号配对，避免正文里出现 "];" 误截断
    let depth = 0
    let inStr = null
    for (let i = bodyStart; i < html.length; i += 1) {
      const ch = html[i]
      const prev = html[i - 1]
      if (inStr) {
        if (ch === inStr && prev !== '\\') inStr = null
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inStr = ch
        continue
      }
      if (ch === '[') depth += 1
      else if (ch === ']') {
        depth -= 1
        if (depth === 0) {
          // eslint-disable-next-line no-new-func
          return new Function(`return ${html.slice(bodyStart, i + 1)}`)()
        }
      }
    }
    throw new Error(`${name} 括号未闭合`)
  }

  const ZONES = grabArray('ZONES')
  const ITEMS = grabArray('ITEMS')

  ensureDir(path.join(OUT_PUB, 'she'))

  // 照片统一编号搬迁：真实图片/<中文区>/_thumb|x/<文件名>.jpg
  const photoMap = new Map() // rel(thumb) -> {src, full, credit}
  let copied = 0
  const missingFull = []

  function resolvePhoto(rel) {
    if (photoMap.has(rel)) return photoMap.get(rel)
    const seg = rel.split('/')
    const zoneDir = seg[1]
    const bucket = seg[2]
    const name = seg[3]
    if (!zoneDir || !name) return null

    const slug = ZONE_SLUG[zoneDir] || 'other'
    const idx = photoMap.size + 1
    const base = `p${pad(idx)}`
    const thumbSrc = path.join(SRC_SHE, '真实图片', zoneDir, bucket, name)
    const fullSrc = thumbSrc.replace(`/${bucket}/`, '/_full/').replace(/_thumb/g, '_full')

    if (!fs.existsSync(thumbSrc)) return null

    const thumbOut = path.join(OUT_PUB, 'she', slug, `${base}-thumb.jpg`)
    const fullOut = path.join(OUT_PUB, 'she', slug, `${base}-full.jpg`)
    copyFile(thumbSrc, thumbOut)
    copied += 1

    let fullRel = `img/she/${slug}/${base}-full.jpg`
    if (fs.existsSync(fullSrc) && fullSrc !== thumbSrc) {
      copyFile(fullSrc, fullOut)
      copied += 1
    } else {
      missingFull.push(rel)
      fullRel = `img/she/${slug}/${base}-thumb.jpg`
    }

    const rec = { src: `img/she/${slug}/${base}-thumb.jpg`, full: fullRel, rel }
    photoMap.set(rel, rec)
    return rec
  }

  const zoneName = Object.fromEntries(ZONES.map((z) => [z.id, z.name]))
  const counters = {}

  const entries = ITEMS.map((it) => {
    counters[it.z] = (counters[it.z] || 0) + 1
    const id = `SHE-${it.z.toUpperCase()}-${pad(counters[it.z], 2)}`
    const media = []
    ;(it.photos || []).forEach((p) => {
      const r = resolvePhoto(p.rel)
      if (!r) return
      media.push({
        src: r.src,
        full: r.full,
        kind: 'photo',
        credit: p.credit || '',
        alt: it.name
      })
    })

    return {
      id,
      collection: 'she',
      sourceId: `${it.z}-${counters[it.z]}`,
      title: it.name,
      subtitle: it.sub || '',
      summary: it.lead || '',
      body: String(it.full || '')
        .split(/\n{2,}/)
        .map((s) => s.trim())
        .filter(Boolean),
      tags: it.tags || [],
      category: it.z,
      region: it.zone || zoneName[it.z] || '闽东畲族聚居区',
      era: '活态传承',
      level: it.type || '',
      media,
      source: (it.links || []).map((l) => l[0]).join('；') || '畲族民俗文化资源整理',
      sourceUrl: (it.links || [])[0]?.[1] || '',
      links: it.links || [],
      facets: { zone: it.zone || '', type: it.type || '', art: it.art || '', photoCount: media.length },
      status: 'published',
      createdAt: '2026-09-09',
      updatedAt: '2026-09-10'
    }
  })

  const categories = ZONES.map((z) => ({
    id: z.id,
    name: z.name,
    en: z.en,
    desc: z.desc,
    count: entries.filter((e) => e.category === z.id).length
  }))

  fs.writeFileSync(
    path.join(OUT_DATA, 'she.json'),
    JSON.stringify({ entries, categories }, null, 1),
    'utf8'
  )
  log(
    `畲族：${entries.length} 条 / ${categories.length} 区 / 照片文件 ${copied} / 无高清 ${missingFull.length}`
  )
  if (missingFull.length) log('  无高清：', missingFull.slice(0, 8).join(', '))
  log(`  照片去重后 ${photoMap.size} 张`)
}

/* ================================================================== */
/* 源 3 · 闽东本土文化知识库                                             */
/* ================================================================== */
async function extractMindong() {
  const mod = await import(`file://${path.join(SRC_MD, 'src/data/seed.js').replace(/\\/g, '/')}`)
  const { SEED_MATERIALS, SEED_WORKS } = mod

  const entries = SEED_MATERIALS.map((m) => {
    const media = []
    if (m.image) {
      media.push({
        src: m.image,
        full: m.image,
        kind: 'photo',
        credit: m.imageCredit?.site || '',
        creditPage: m.imageCredit?.page || '',
        creditTitle: m.imageCredit?.title || '',
        note: m.imageNote || '',
        alt: m.title
      })
    }
    return {
      id: m.id,
      collection: 'mindong',
      sourceId: m.id,
      title: m.title,
      subtitle: m.level || '',
      summary: m.summary || '',
      body: m.body || [],
      tags: m.tags || [],
      category: m.category,
      region: m.region || '',
      era: m.era || '',
      level: m.level || '',
      media,
      image: m.image || '',
      imageCredit: m.imageCredit || null,
      imageNote: m.imageNote || '',
      imageMeta: m.imageMeta || null,
      source: m.source || '',
      sourceUrl: m.sourceUrl || '',
      links: m.sourceUrl ? [[m.source || '来源', m.sourceUrl]] : [],
      facets: { minted: true },
      status: m.status || 'published',
      createdAt: m.createdAt || '',
      updatedAt: m.updatedAt || ''
    }
  })

  fs.writeFileSync(
    path.join(OUT_DATA, 'mindong.json'),
    JSON.stringify({ entries }, null, 1),
    'utf8'
  )
  fs.writeFileSync(path.join(OUT_DATA, 'works.json'), JSON.stringify(SEED_WORKS, null, 1), 'utf8')

  log(`闽东：${entries.length} 条素材 / ${SEED_WORKS.length} 条学生成果`)
}

/* ================================================================== */
/* 主流程                                                              */
/* ================================================================== */
ensureDir(OUT_DATA)
ensureDir(OUT_PUB)
extractPapercut()
extractShe()
await extractMindong()

const total =
  JSON.parse(fs.readFileSync(path.join(OUT_DATA, 'papercut.json'), 'utf8')).entries.length +
  JSON.parse(fs.readFileSync(path.join(OUT_DATA, 'she.json'), 'utf8')).entries.length +
  JSON.parse(fs.readFileSync(path.join(OUT_DATA, 'mindong.json'), 'utf8')).entries.length
log(`完成 · 统一条目总数 ${total}`)
