/** 把候选拼成对照表，供目检：每行一个条目，4 个候选横排 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '..')
const CAND = path.join(ROOT, 'work/cand')
const OUT = path.join(ROOT, 'work/sheet')
fs.mkdirSync(OUT, { recursive: true })

const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'work/cand-index.json'), 'utf8'))
const ids = Object.keys(index).sort()

const CELL_W = 250
const CELL_H = 170
const LABEL_W = 150
const GAP = 8
const PAD = 12
const ROWS_PER_SHEET = 9

;(async () => {
  const width = LABEL_W + 4 * (CELL_W + GAP) + PAD * 2
  for (let s = 0; s * ROWS_PER_SHEET < ids.length; s++) {
    const group = ids.slice(s * ROWS_PER_SHEET, (s + 1) * ROWS_PER_SHEET)
    const height = group.length * (CELL_H + GAP) + PAD * 2
    const layers = []
    for (let r = 0; r < group.length; r++) {
      const id = group[r]
      const top = PAD + r * (CELL_H + GAP)
      layers.push({
        input: Buffer.from(
          `<svg width="${LABEL_W}" height="${CELL_H}"><rect width="100%" height="100%" fill="#f3efe6"/><text x="8" y="28" font-family="Arial" font-size="15" font-weight="bold" fill="#2b2119">${id}</text><text x="8" y="52" font-family="Arial" font-size="11" fill="#7a6a58">${group[r] === id ? '4 cand.' : ''}</text></svg>`
        ),
        top,
        left: PAD
      })
      const picks = index[id].picked || []
      for (let c = 0; c < 4; c++) {
        const left = PAD + LABEL_W + c * (CELL_W + GAP)
        if (picks[c]) {
          const buf = await sharp(path.join(CAND, id, picks[c].file))
            .resize(CELL_W, CELL_H, { fit: 'cover' })
            .png()
            .toBuffer()
          layers.push({ input: buf, top, left })
        } else {
          layers.push({
            input: Buffer.from(
              `<svg width="${CELL_W}" height="${CELL_H}"><rect width="100%" height="100%" fill="#efe9dd"/><text x="12" y="90" font-family="Arial" font-size="12" fill="#b0a493">no candidate</text></svg>`
            ),
            top,
            left
          })
        }
        layers.push({
          input: Buffer.from(
            `<svg width="30" height="22"><rect width="30" height="22" fill="#2b2119" opacity="0.82"/><text x="9" y="16" font-family="Arial" font-size="12" fill="#fff">c${c + 1}</text></svg>`
          ),
          top: top + CELL_H - 22,
          left
        })
      }
    }
    const file = path.join(OUT, `sheet-${s + 1}.png`)
    await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
      .composite(layers)
      .png()
      .toFile(file)
    console.log('sheet', s + 1, group[0], '→', group[group.length - 1], file)
  }
})()
