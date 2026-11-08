/**
 * sheet-final.mjs —— 落地成品拼版（不是候选）
 *
 * 上一轮闽东的教训：只看候选看不出「选中的那张其实题材不对」，
 * 必须把**已经处理完的成品**拼起来看，才能发现裁切切掉了主体、色调不齐之类的问题。
 *
 * 用法：node scripts/sheet-final.mjs [目录] [每行张数]
 * 默认：public/img/matched，每行 5 张
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const dir = process.argv[2] || path.join('public', 'img', 'matched');
const per = Number(process.argv[3] || 5);
const ABS = path.join(ROOT, dir);
const OUT = path.join(ROOT, '.img-staging', 'sheets', 'final-' + path.basename(dir) + '.png');

const files = fs
  .readdirSync(ABS)
  .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
  .sort();

const CELL_W = 320;
const CELL_H = 240;
const GAP = 8;
const LABEL = 24;
const PAD = 12;

const cols = Math.min(per, files.length);
const rows = Math.ceil(files.length / cols);
const width = PAD * 2 + cols * CELL_W + (cols - 1) * GAP;
const height = PAD * 2 + rows * (CELL_H + LABEL + GAP);

const layers = [];
const texts = [];
let n = 0;

for (const f of files) {
  const i = n++;
  const r = Math.floor(i / cols);
  const c = i % cols;
  const x = PAD + c * (CELL_W + GAP);
  const y = PAD + r * (CELL_H + LABEL + GAP);
  try {
    const buf = await sharp(path.join(ABS, f))
      .resize(CELL_W, CELL_H, { fit: 'cover' })
      .jpeg({ quality: 82 })
      .toBuffer();
    layers.push({ input: buf, left: x, top: y });
  } catch {
    /* skip broken */
  }
  const name = f.replace(/\.[^.]+$/, '');
  texts.push(
    `<rect x="${x}" y="${y + CELL_H}" width="${CELL_W}" height="${LABEL}" fill="#111" opacity="0.8"/>`,
    `<text x="${x + 6}" y="${y + CELL_H + 17}" font-family="Microsoft YaHei,Segoe UI" font-size="12" fill="#fff">${name}</text>`
  );
}

const svg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${texts.join('')}</svg>`);

await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
  .composite([...layers, { input: svg, left: 0, top: 0 }])
  .png()
  .toFile(OUT);

console.log(`${files.length} 张 -> ${path.relative(ROOT, OUT).replace(/\\/g, '/')} (${width}x${height})`);
