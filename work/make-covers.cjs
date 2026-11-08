/**
 * 统一生成 334 张标准配图
 * 规格：1200×900 / JPEG q82 / 纸色底 #f4efe4 / 统一细描边 / 统一暖调
 * 竖版文献图版用 contain 完整入框，实景照片与检索图用 cover 满幅
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '..')
const PUB = path.join(ROOT, 'public')
const CAND = path.join(ROOT, 'work/cand')
const OUT = path.join(PUB, 'img/cover')
const PAPER = { r: 244, g: 239, b: 228, alpha: 1 }
const W = 1200
const H = 900
const Q = 82

fs.mkdirSync(OUT, { recursive: true })

const audit = JSON.parse(fs.readFileSync(path.join(ROOT, 'work/audit.json'), 'utf8'))
const sel = JSON.parse(fs.readFileSync(path.join(ROOT, 'work/selections.json'), 'utf8'))
const cidx = JSON.parse(fs.readFileSync(path.join(ROOT, 'work/cand-index.json'), 'utf8'))

const FRAME = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="rgba(43,33,25,0.14)" stroke-width="1"/></svg>`
)

/** 取检索图记录里的来源信息 */
function webMeta(id) {
  const s = sel[id]
  const rec = cidx[s.key]?.picked?.find((p) => p.file.replace('.jpg', '') === s.pick)
  if (!rec) return null
  let host = ''
  try {
    host = new URL(rec.purl).hostname.replace(/^www\./, '')
  } catch {}
  return { ...rec, host }
}

async function build(row) {
  const id = row.id
  const selRec = sel[id]
  let srcBuf
  let fit = 'cover'
  let bottomTrim = 0
  let sourceType
  let srcLabel

  if (selRec) {
    const f = path.join(CAND, selRec.key, selRec.pick + '.jpg')
    if (!fs.existsSync(f)) return { id, ok: false, reason: '检索候选文件缺失' }
    srcBuf = await sharp(f).rotate().toBuffer()
    bottomTrim = 0.12
    sourceType = 'web'
    srcLabel = '联网检索'
  } else {
    if (row.status !== 'ok') return { id, ok: false, reason: '无可用原始图' }
    const rel = row.main.full || row.main.src
    const f = path.join(PUB, rel)
    if (!fs.existsSync(f)) return { id, ok: false, reason: '原始文件不存在：' + rel }
    srcBuf = await sharp(f).rotate().toBuffer()
    sourceType = row.collection === 'papercut' ? 'plate' : 'photo'
    srcLabel = sourceType === 'plate' ? '原图录图版' : '原实景/素材照片'
  }

  // 网检图裁掉底部站标
  if (bottomTrim > 0) {
    const m = await sharp(srcBuf).metadata()
    const keepH = Math.max(1, Math.round(m.height * (1 - bottomTrim)))
    srcBuf = await sharp(srcBuf).extract({ left: 0, top: 0, width: m.width, height: keepH }).toBuffer()
  }

  const meta = await sharp(srcBuf).metadata()
  const ar = meta.width / meta.height
  // 文献图版一律完整入框（不裁边饰），其余竖版也完整入框
  if (sourceType === 'plate' || ar < 0.85) fit = 'contain'

  let pipe = sharp(srcBuf).resize(W, H, {
    fit: 'contain',
    background: PAPER,
    kernel: 'lanczos3',
    position: 'centre'
  })
  if (fit === 'cover') {
    pipe = sharp(srcBuf).resize(W, H, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
  }

  let outBuf = await pipe.modulate({ saturation: 1.03, brightness: 1.012 }).linear(1.02, -2).toBuffer()
  outBuf = await sharp(outBuf).composite([{ input: FRAME }]).jpeg({ quality: Q, progressive: true, mozjpeg: true }).toBuffer()

  fs.writeFileSync(path.join(OUT, id + '.jpg'), outBuf)

  let entry
  if (sourceType === 'web') {
    const wm = webMeta(id)
    entry = {
      cover: `img/cover/${id}.jpg`,
      kind: 'web',
      fit,
      source: wm ? wm.host : '联网检索',
      sourceUrl: wm?.purl || '',
      credit: wm?.title || '',
      license: '第三方网站图片，教学引用；正式出版需另行取得授权',
      query: cidx[selRec.key]?.queries || []
    }
  } else {
    entry = {
      cover: `img/cover/${id}.jpg`,
      kind: sourceType,
      fit,
      source: srcLabel,
      sourceUrl: row.main.creditPage || '',
      credit: row.main.credit || '',
      license: sourceType === 'plate' ? '原始项目文献图版' : '原始项目实景/素材照片（来源见 credit）'
    }
  }
  return { id, ok: true, entry, fit, bytes: outBuf.length }
}

;(async () => {
  const rows = audit.rows
  const items = {}
  const failed = []
  let done = 0
  let totalBytes = 0
  const CONC = 4

  for (let i = 0; i < rows.length; i += CONC) {
    const batch = rows.slice(i, i + CONC)
    const res = await Promise.all(batch.map((r) => build(r).catch((e) => ({ id: r.id, ok: false, reason: e.message.slice(0, 60) }))))
    for (const r of res) {
      if (r.ok) {
        items[r.id] = r.entry
        totalBytes += r.bytes
        done++
      } else failed.push({ id: r.id, title: rows.find((x) => x.id === r.id)?.title || '', reason: r.reason })
    }
    if ((i / CONC) % 15 === 0) process.stdout.write(`  ...${done}/${rows.length}\r`)
  }

  const manifest = {
    generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    spec: { width: W, height: H, format: 'jpeg', quality: Q, background: '#f4efe4', frame: 'rgba(43,33,25,0.14) 1px', tone: 'saturation +3% / brightness +1.2% / contrast +2%' },
    total: rows.length,
    covered: done,
    failed: failed.length,
    items
  }
  fs.writeFileSync(path.join(ROOT, 'src/data/covers.json'), JSON.stringify(manifest, null, 1))
  fs.writeFileSync(path.join(ROOT, 'work/covers-failed.json'), JSON.stringify(failed, null, 1))

  console.log('\n=== 完成 ===')
  console.log('生成', done, '/', rows.length, '| 失败', failed.length)
  console.log('总体积', (totalBytes / 1024 / 1024).toFixed(1), 'MB | 平均', Math.round(totalBytes / Math.max(1, done) / 1024), 'KB/张')
  const byFit = {}
  for (const v of Object.values(items)) byFit[v.kind + '/' + v.fit] = (byFit[v.kind + '/' + v.fit] || 0) + 1
  console.log('构成：', JSON.stringify(byFit))
  failed.forEach((f) => console.log('  失败', f.id, f.reason))
})()
