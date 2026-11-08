/** 补搜指定条目（换更聚焦的检索词） */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '..')
const CAND = path.join(ROOT, 'work/cand')
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const BLOCK =
  /(699pic|588ku|58pic|51miz|16pic|tooopen|veer\.com|gettyimages|shutterstock|dreamstime|istockphoto|zcool|nitu|nipic|photophoto|tukuppt|pikbest|lovepik|zhituwang|bigstock|alamy|123rf|taobao|tmall|1688|jd\.com|douyin|kuaishou|bilibili|youtube)/i
const VIDEO = /(\.mp4|\.mov|\.avi|\.m3u8|视频|video[-_]?cover|a_W)/i

const JOBS = [
  { id: 'HS2-003', queries: ['山区 流域 集水区 航拍', '湿地 河流 航拍 生态', 'aerial river wetland landscape'] },
  { id: 'SHE-ARCHIVE-01', queries: ['中药材 晾晒 药材', '中草药 种植 基地', 'dried chinese herbal medicine'] }
]

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

async function bing(q) {
  try {
    const res = await fetch(
      `https://cn.bing.com/images/async?q=${encodeURIComponent(q)}&first=1&count=35&mkt=zh-CN&adlt=off`,
      { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' }, signal: AbortSignal.timeout(20000) }
    )
    const html = await res.text()
    const out = []
    const re = /m="([^"]+)"/g
    let m
    while ((m = re.exec(html))) {
      try {
        const o = JSON.parse(decode(m[1]))
        if (o.murl) out.push({ murl: o.murl, purl: o.purl || '', title: (o.t || '').slice(0, 100) })
      } catch {}
    }
    return out
  } catch {
    return []
  }
}

async function dl(url, dest) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://cn.bing.com/' }, signal: AbortSignal.timeout(20000) })
    if (!res.ok) return null
    if (!/image\//.test(res.headers.get('content-type') || '')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 15 * 1024) return null
    const meta = await sharp(buf).metadata()
    if (!meta.width || meta.width < 700 || meta.height < 450) return null
    await sharp(buf).jpeg({ quality: 88 }).toFile(dest)
    return { w: meta.width, h: meta.height }
  } catch {
    return null
  }
}

;(async () => {
  const idxPath = path.join(ROOT, 'work/cand-index.json')
  const index = JSON.parse(fs.readFileSync(idxPath, 'utf8'))
  for (const j of JOBS) {
    const pool = []
    const seen = new Set()
    for (const q of j.queries) {
      for (const it of await bing(q)) {
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
    const dir = path.join(CAND, j.id + '-v2')
    fs.mkdirSync(dir, { recursive: true })
    const picked = []
    let n = 0
    for (const it of pool) {
      if (picked.length >= 6) break
      if (++n > 20) break
      const r = await dl(it.murl, path.join(dir, `c${picked.length + 1}.jpg`))
      if (r) picked.push({ file: `c${picked.length + 1}.jpg`, w: r.w, h: r.h, purl: it.purl, title: it.title, murl: it.murl })
    }
    index[j.id + '-v2'] = { queries: j.queries, pool: pool.length, picked }
    console.log(j.id, '池', pool.length, '→', picked.length)
  }
  fs.writeFileSync(idxPath, JSON.stringify(index, null, 1))
})()
