/**
 * check-wm.mjs —— 批量检查图片右下角是否有水印/台标
 * 用法：node work/check-wm.mjs out.png a.jpg b.jpg ...
 * 取每张图右下 30%×25% 放大 2 倍并排，一眼就能看出有没有「闽东日报」「东南网」这类印记。
 */
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const [out, ...files] = process.argv.slice(2)
const CW = 300
const CH = 110
const PAD = 8
const LBL = 16

const tiles = []
const labels = []
for (let i = 0; i < files.length; i++) {
  const p = path.isAbsolute(files[i]) ? files[i] : path.join(ROOT, files[i])
  const m = await sharp(p).metadata()
  const w = Math.round(m.width * 0.34)
  const h = Math.round(m.height * 0.26)
  const buf = await sharp(p)
    .extract({ left: m.width - w, top: m.height - h, width: w, height: h })
    .resize(CW, CH, { fit: 'fill' })
    .toBuffer()
  const col = i % 3
  const row = Math.floor(i / 3)
  tiles.push({ input: buf, left: PAD + col * (CW + PAD), top: PAD + row * (CH + LBL + PAD) })
  labels.push(
    `<text x="${PAD + col * (CW + PAD)}" y="${PAD + row * (CH + LBL + PAD) + CH + 12}" font-family="Consolas,monospace" font-size="11" fill="#111">${path.basename(files[i])}</text>`
  )
}

const rows = Math.ceil(files.length / 3)
const W = PAD + 3 * (CW + PAD)
const H = PAD + rows * (CH + LBL + PAD)
const svg = Buffer.from(
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${labels.join('')}</svg>`
)
await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
  .composite([...tiles, { input: svg, left: 0, top: 0 }])
  .png()
  .toFile(path.resolve(ROOT, out))
console.log('ok', out, W + 'x' + H)
