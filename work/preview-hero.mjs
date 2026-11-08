/**
 * preview-hero.mjs —— 预演「一张主图 + 右侧三条细带」的封面排布
 * 卡片真实尺寸很小（377×212），四等分必然只剩色块；这种排布保留一个能认人的主体，
 * 右边三条只当索引，不当主角。
 */
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const args = Object.fromEntries(
  process.argv.slice(2).map((s) => {
    const m = s.match(/^--([\w-]+)=?(.*)$/)
    return m ? [m[1], m[2] || true] : [s, true]
  })
)
const [W, H] = String(args.size || '754x424').split('x').map(Number)
const cells = String(args.cells).split(',').map((p) => (path.isAbsolute(p) ? p : path.join(ROOT, p)))
const out = path.resolve(args.out)
const GAP = 2
const mainW = Math.round((W - GAP) * Number(args.share || 0.7))
const sideW = W - mainW - GAP
const side = cells.slice(1, 4)
const sideH = Math.floor((H - (side.length - 1) * GAP) / side.length)

const layers = [
  {
    input: await sharp(cells[0]).resize(mainW, H, { fit: 'cover', position: 'centre' }).toBuffer(),
    left: 0,
    top: 0
  }
]
side.forEach((p, i) => {
  layers.push({
    input: null,
    _src: p,
    left: mainW + GAP,
    top: i * (sideH + GAP),
    w: sideW,
    h: sideH
  })
})
for (const l of layers) {
  if (l._src) {
    l.input = await sharp(l._src).resize(l.w, l.h, { fit: 'cover', position: 'centre' }).toBuffer()
    delete l._src
    delete l.w
    delete l.h
  }
}

const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0%" stop-color="#2b2119" stop-opacity="0.9"/>
    <stop offset="48%" stop-color="#2b2119" stop-opacity="0.35"/>
    <stop offset="100%" stop-color="#2b2119" stop-opacity="0.04"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  ${args.en ? `<text x="18" y="${H - 44}" font-family="Georgia,serif" font-size="9" letter-spacing="3" fill="#f4efe4" opacity="0.66">${args.en}</text>` : ''}
  ${args.title ? `<text x="18" y="${H - 20}" font-family="Microsoft YaHei,serif" font-size="20" font-weight="bold" fill="#f4efe4">${args.title}</text>` : ''}
</svg>`)

await sharp({ create: { width: W, height: H, channels: 3, background: '#f4efe4' } })
  .composite([...layers, { input: svg, left: 0, top: 0 }])
  .png()
  .toFile(out)
console.log('ok', path.relative(ROOT, out).replace(/\\/g, '/'), `主 ${mainW} 侧 ${sideW}×${sideH}`)
