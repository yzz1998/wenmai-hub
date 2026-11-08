/**
 * 资源库配图全量审计
 * 逐条核对：media 引用 → 文件是否存在 → 是否有效图像 → 是否与他条重复
 * 产出 work/audit.json 与分类统计
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.resolve(__dirname, '..')
const PUB = path.join(ROOT, 'public')

const SOURCES = [
  { file: 'papercut', collection: 'papercut', label: '剪纸图样' },
  { file: 'she', collection: 'she', label: '畲族展项' },
  { file: 'mindong', collection: 'mindong', label: '闽东素材' },
  { file: 'hs-ch2', collection: 'hs-res', label: '第二章' },
  { file: 'hs-ch5', collection: 'hs-city', label: '第五章' }
]

/** 读文件头判断真实图像类型 */
function sniff(buf) {
  if (!buf || buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg'
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'webp'
  if (buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a') return 'png'
  if (buf.slice(0, 3).toString('ascii') === 'GIF') return 'gif'
  if (buf.slice(0, 4).toString('ascii').trim() === '<svg' || buf.slice(0, 5).toString('ascii').includes('svg')) return 'svg'
  return 'unknown'
}

const norm = (s) => String(s || '').replace(/^\.?\//, '')
const cache = new Map()

function inspect(src) {
  const rel = norm(src)
  if (!rel) return { rel, exists: false, reason: '字段为空' }
  if (cache.has(rel)) return cache.get(rel)
  const abs = path.join(PUB, rel)
  let out
  if (!fs.existsSync(abs)) {
    out = { rel, exists: false, reason: '文件不存在' }
  } else {
    const st = fs.statSync(abs)
    if (st.size === 0) {
      out = { rel, exists: true, size: 0, reason: '零字节空文件' }
    } else {
      const buf = fs.readFileSync(abs)
      const kind = sniff(buf)
      out = {
        rel,
        exists: true,
        size: st.size,
        type: kind,
        md5: crypto.createHash('md5').update(buf).digest('hex'),
        reason: kind === 'unknown' ? '文件头非图像' : null
      }
    }
  }
  cache.set(rel, out)
  return out
}

const rows = []
for (const s of SOURCES) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', s.file + '.json'), 'utf8'))
  const arr = d.entries || d
  for (const e of arr) {
    const media = Array.isArray(e.media) ? e.media : []
    const main = media[0] || null
    const checks = []
    if (main) {
      if (main.src) checks.push({ field: 'src', ...inspect(main.src) })
      if (main.full && main.full !== main.src) checks.push({ field: 'full', ...inspect(main.full) })
    }
    const bad = checks.filter((c) => !c.exists || c.reason)
    rows.push({
      id: e.id,
      collection: s.collection,
      source: s.file,
      sourceLabel: s.label,
      title: e.title,
      category: e.category,
      summary: (e.summary || '').slice(0, 120),
      body: (e.body || []).join(' ').slice(0, 200),
      tags: e.tags || [],
      mediaCount: media.length,
      main: main ? { src: norm(main.src), full: norm(main.full || main.src), kind: main.kind, credit: main.credit || '', creditPage: main.creditPage || '' } : null,
      checks,
      status: !main ? 'no-media' : bad.length ? 'broken' : 'ok'
    })
  }
}

/* ---------- 重复检测 ---------- */
const byHash = new Map()
for (const r of rows) {
  for (const c of r.checks) {
    if (c.md5) {
      if (!byHash.has(c.md5)) byHash.set(c.md5, [])
      byHash.get(c.md5).push({ id: r.id, rel: c.rel })
    }
  }
}
// 同一张图被不同条目用作主图 → 视为「跨条目重复」
const mainGroups = new Map()
for (const r of rows) {
  const md5 = r.checks.find((c) => c.field === 'src' && c.md5)?.md5
  if (!md5) continue
  if (!mainGroups.has(md5)) mainGroups.set(md5, [])
  mainGroups.get(md5).push(r.id)
}
const crossDup = [...mainGroups.values()].filter((g) => new Set(g).size > 1)

/* ---------- 统计 ---------- */
const stat = { total: rows.length, ok: 0, broken: 0, noMedia: 0 }
for (const r of rows) {
  if (r.status === 'ok') stat.ok++
  else if (r.status === 'broken') stat.broken++
  else stat.noMedia++
}

const perSource = {}
for (const r of rows) {
  perSource[r.source] = perSource[r.source] || { total: 0, ok: 0, broken: 0, noMedia: 0 }
  perSource[r.source].total++
  perSource[r.source][r.status === 'ok' ? 'ok' : r.status === 'broken' ? 'broken' : 'noMedia']++
}

fs.writeFileSync(path.join(ROOT, 'work/audit.json'), JSON.stringify({ stat, perSource, rows, crossDup }, null, 1))

console.log('=== 审计汇总 ===')
console.log('总计', stat.total, '| 有有效图', stat.ok, '| 引用破损', stat.broken, '| 完全无图', stat.noMedia)
console.log('--- 按来源 ---')
for (const [k, v] of Object.entries(perSource)) console.log(' ', k.padEnd(10), JSON.stringify(v))
console.log('--- 跨条目重复主图 ---', crossDup.length, '组')
crossDup.slice(0, 10).forEach((g) => console.log('  ', g.join(' / ')))
console.log('--- 破损明细 ---')
rows.filter((r) => r.status === 'broken').forEach((r) => console.log('  ', r.id, r.title.slice(0, 20), '|', r.checks.filter((c) => !c.exists || c.reason).map((c) => c.rel + ':' + (c.reason || '?')).join('; ')))
console.log('--- 无图明细 ---')
rows.filter((r) => r.status === 'no-media').forEach((r) => console.log('  ', r.id, r.title.slice(0, 26)))
