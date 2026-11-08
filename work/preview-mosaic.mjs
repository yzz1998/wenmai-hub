/**
 * preview-mosaic.mjs —— 预演「一块封面 = 若干格」的排布，所见即卡片所得
 *
 * 支持三种排布：
 *   --layout=strip  n 列等分（现有做法，每格约 4:9）
 *   --layout=grid   2×2（每格约 16:9，手机与桌面都读得清）
 *   --layout=hero   整幅单图
 * 并把馆名按卡片真实位置压上去，用来判断文字会不会被亮部吃掉。
 *
 * node work/preview-mosaic.mjs --out=a.png --cells=x.jpg,y.jpg[,z.jpg,w.jpg] --layout=grid
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

const out = path.resolve(args.out || 'work/shots/mosaic.png')
const [W, H] = String(args.size || '377x212').split('x').map(Number)
const layout = String(args.layout || 'grid')
const cells = String(args.cells || '')
  .split(',')
  .filter(Boolean)
  .map((p) => (path.isAbsolute(p) ? p : path.join(ROOT, p)))
const title = args.title ? String(args.title) : ''
const en = args.en ? String(args.en) : ''
const GAP = 2

let boxes = []
if (layout === 'hero') {
  boxes = [{ left: 0, top: 0, w: W, h: H }]
} else if (layout === 'grid') {
  const cw = Math.floor((W - GAP) / 2)
  const ch = Math.floor((H - GAP) / 2)
  boxes = [
    { left: 0, top: 0, w: cw, h: ch },
    { left: cw + GAP, top: 0, w: W - cw - GAP, h: ch },
    { left: 0, top: ch + GAP, w: cw, h: H - ch - GAP },
    { left: cw + GAP, top: ch + GAP, w: W - cw - GAP, h: H - ch - GAP }
  ]
} else {
  const n = cells.length
  const cw = Math.floor((W - (n - 1) * GAP) / n)
  boxes = cells.map((_, i) => ({ left: i * (cw + GAP), top: 0, w: cw, h: H }))
}

const layers = []
for (let i = 0; i < Math.min(cells.length, boxes.length); i++) {
  const b = boxes[i]
  const buf = await sharp(cells[i])
    .resize(b.w, b.h, { fit: 'cover', position: 'centre' })
    .toBuffer()
  layers.push({ input: buf, left: b.left, top: b.top })
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#2b2119" stop-opacity="0.88"/>
      <stop offset="45%" stop-color="#2b2119" stop-opacity="0.40"/>
      <stop offset="100%" stop-color="#2b2119" stop-opacity="0.06"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  ${en ? `<text x="18" y="${H - 44}" font-family="Georgia,serif" font-size="9" letter-spacing="3" fill="#f4efe4" opacity="0.66">${esc(en)}</text>` : ''}
  ${title ? `<text x="18" y="${H - 20}" font-family="Microsoft YaHei,serif" font-size="20" font-weight="bold" fill="#f4efe4">${esc(title)}</text>` : ''}
</svg>`)

await sharp({ create: { width: W, height: H, channels: 3, background: '#f4efe4' } })
  .composite([...layers, { input: svg, left: 0, top: 0 }])
  .png()
  .toFile(out)

console.log('ok', path.relative(ROOT, out).replace(/\\/g, '/'), layout, boxes[0]?.w + 'x' + boxes[0]?.h)
