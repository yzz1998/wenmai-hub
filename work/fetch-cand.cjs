/**
 * 分条联网检索配图：Bing 图片搜索 → 过滤图库水印站/视频 → 下载候选 → 校验尺寸
 * 用法：node work/fetch-cand.cjs <from> <to>   按 TASKS 下标区间分批跑
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '..')
const CAND = path.join(ROOT, 'work/cand')
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** 水印图库 / 素材站 / 视频站：一律排除 */
const BLOCK = /(699pic|588ku|58pic|51miz|16pic|tooopen|veer\.com|gettyimages|shutterstock|dreamstime|istockphoto|zcool|nitu|nipic|photophoto|tukuppt|pikbest|lovepik|zhituwang|bigstock|alamy|123rf|picjumbo|taobao|tmall|1688|jd\.com|douyin|kuaishou|bilibili|youtube)/i
const VIDEO = /(\.mp4|\.mov|\.avi|\.m3u8|视频|video[-_]?cover|a_W)/i

const TASKS = [
  { id: 'SHE-LANG-01', zh: '畲族 凤凰装 传统服饰', en: 'She ethnic minority costume China' },
  { id: 'SHE-LANG-02', zh: '畲族 古村落 山哈', en: '' },
  { id: 'SHE-LANG-03', zh: '畲族 宗祠 祠堂 宗谱', en: '' },
  { id: 'SHE-LANG-04', zh: '畲族 山歌 对唱 歌会', en: '' },
  { id: 'SHE-FESTIVAL-02', zh: '畲族 婚俗 婚礼 花轿', en: '' },
  { id: 'SHE-CRAFT-04', zh: '木拱廊桥 福建 廊桥', en: 'wooden arch covered bridge Fujian' },
  { id: 'SHE-ARCHIVE-01', zh: '畲族 医药 中草药 晾晒', en: '' },
  { id: 'SHE-RIBBON-05', zh: '畲族 彩带 织带 编织', en: '' },

  { id: 'HS2-001', zh: '自然资源 山川 河流 生态', en: 'natural resources landscape' },
  { id: 'HS2-002', zh: '露天矿 采矿 矿石', en: 'open pit mine' },
  { id: 'HS2-003', zh: '流域 山水 生态系统', en: 'watershed landscape aerial' },
  { id: 'HS2-004', zh: '课堂 学生 教学', en: 'students classroom' },
  { id: 'HS2-005', zh: '燃煤电厂 烟囱 工业', en: 'coal power plant' },
  { id: 'HS2-006', zh: '人群 拥挤 街道 人流', en: 'crowd people street' },
  { id: 'HS2-007', zh: '铜矿 露天采矿 矿坑', en: 'copper mine pit' },
  { id: 'HS2-008', zh: '雾霾 城市 空气污染', en: 'smog air pollution city' },
  { id: 'HS2-009', zh: '地球 太空 蓝色星球', en: 'Earth from space' },
  { id: 'HS2-010', zh: '太阳能 光伏 电站 风机', en: 'solar panels wind turbines' },
  { id: 'HS2-011', zh: '垃圾 回收 分拣 再生资源', en: 'recycling plant waste sorting' },
  { id: 'HS2-012', zh: '中国 光伏电站 沙漠', en: 'solar farm China' },

  { id: 'HS5-001', zh: '古城 遗址 城墙 考古', en: 'ancient city ruins' },
  { id: 'HS5-002', zh: '城市 天际线 航拍 高楼', en: 'city skyline aerial' },
  { id: 'HS5-003', zh: '城市 扩张 建成区 航拍', en: 'urban sprawl aerial' },
  { id: 'HS5-004', zh: '郊区 住宅区 航拍', en: 'suburb houses aerial' },
  { id: 'HS5-005', zh: '中国 城市 高楼 天际线', en: 'Chinese city skyline' },
  { id: 'HS5-006', zh: '城市 交通拥堵 车流', en: 'traffic congestion city' },
  { id: 'HS5-007', zh: '麦田 麦穗 金黄', en: 'wheat field' },
  { id: 'HS5-008', zh: '梯田 水田 耕作 牛耕', en: 'rice terraces China' },
  { id: 'HS5-009', zh: '联合收割机 麦田 机械化', en: 'combine harvester field' },
  { id: 'HS5-010', zh: '中国 乡村 村庄 农舍', en: 'Chinese rural village' },
  { id: 'HS5-011', zh: '纺织厂 机器 车间', en: 'textile mill machines' },
  { id: 'HS5-012', zh: '钢铁厂 高炉 冶炼', en: 'steel mill blast furnace' },
  { id: 'HS5-013', zh: '城市边缘 农田 航拍', en: 'city edge farmland aerial' }
]

const decode = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

async function bingSearch(q) {
  const url = `https://cn.bing.com/images/async?q=${encodeURIComponent(q)}&first=1&count=35&mkt=zh-CN&adlt=off`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
      signal: AbortSignal.timeout(20000)
    })
    const html = await res.text()
    const out = []
    const re = /m="([^"]+)"/g
    let m
    while ((m = re.exec(html))) {
      try {
        const o = JSON.parse(decode(m[1]))
        if (o.murl) out.push({ murl: o.murl, purl: o.purl || '', title: (o.t || '').replace(/&#\d+;/g, '').slice(0, 100) })
      } catch {
        /* skip */
      }
    }
    return out
  } catch {
    return []
  }
}

async function download(url, dest) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: 'https://cn.bing.com/' },
      signal: AbortSignal.timeout(20000)
    })
    if (!res.ok) return { ok: false, reason: 'HTTP ' + res.status }
    const ct = res.headers.get('content-type') || ''
    if (!/image\//.test(ct)) return { ok: false, reason: '非图片 ' + ct.slice(0, 30) }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 15 * 1024) return { ok: false, reason: '文件过小' }
    if (buf.length > 12 * 1024 * 1024) return { ok: false, reason: '文件过大' }
    const meta = await sharp(buf).metadata()
    if (!meta.width || meta.width < 700 || meta.height < 450) {
      return { ok: false, reason: `尺寸不足 ${meta.width}x${meta.height}` }
    }
    await sharp(buf).jpeg({ quality: 88 }).toFile(dest)
    return { ok: true, w: meta.width, h: meta.height, bytes: buf.length }
  } catch (e) {
    return { ok: false, reason: e.name === 'TimeoutError' ? '下载超时' : e.message.slice(0, 40) }
  }
}

;(async () => {
  const from = Number(process.argv[2] || 0)
  const to = Number(process.argv[3] || TASKS.length)
  const idxPath = path.join(ROOT, 'work/cand-index.json')
  const index = fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, 'utf8')) : {}

  for (const t of TASKS.slice(from, to)) {
    const queries = [t.zh, t.en].filter(Boolean)
    const pool = []
    const seen = new Set()
    for (const q of queries) {
      const r = await bingSearch(q)
      for (const it of r) {
        const u = it.murl.split('?')[0]
        if (seen.has(u)) continue
        if (BLOCK.test(it.murl) || BLOCK.test(it.purl)) continue
        if (VIDEO.test(it.murl) || VIDEO.test(it.title)) continue
        if (!/\.(jpg|jpeg|png|webp)$/i.test(u)) continue
        seen.add(u)
        pool.push(it)
      }
      await new Promise((r) => setTimeout(r, 250))
    }

    const dir = path.join(CAND, t.id)
    fs.mkdirSync(dir, { recursive: true })
    const picked = []
    let n = 0
    for (const it of pool) {
      if (picked.length >= 4) break
      n++
      if (n > 14) break
      const dest = path.join(dir, `c${picked.length + 1}.jpg`)
      const r = await download(it.murl, dest)
      if (r.ok) {
        picked.push({ file: `c${picked.length + 1}.jpg`, w: r.w, h: r.h, purl: it.purl, title: it.title, murl: it.murl })
      }
    }
    index[t.id] = { queries, pool: pool.length, picked }
    fs.writeFileSync(idxPath, JSON.stringify(index, null, 1))
    console.log(t.id.padEnd(14), '池', String(pool.length).padStart(3), '→ 下载成功', picked.length, picked.map((p) => p.w + 'x' + p.h).join(' '))
  }
  console.log('done', Object.keys(index).length, '/', TASKS.length)
})()
