/**
 * preview-cover.mjs —— 按专题馆封面卡片的真实裁切比例预演效果
 *
 * 为什么需要它：卡片封面是 16:9 的一整块，内部再切成 4 列窄竖条（每格约 4:9）。
 * 直接看原图会误判——一张很漂亮的 4:3 横图裁成竖条后可能只剩一截树干。
 * 这个脚本按同样的几何关系合成，含压暗渐变与馆名，所见即卡片所得。
 *
 * 用法：
 *   node work/preview-cover.mjs --out=a.png --size=377x212 --cells=a.jpg,b.jpg,c.jpg,d.jpg [--title=馆名] [--en=MINDONG]
 *   node work/preview-cover.mjs --out=b.png --cells=x.jpg --hero
 */

import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';

const ROOT = process.cwd();
const args = Object.fromEntries(
  process.argv.slice(2).map((s) => {
    const m = s.match(/^--([\w-]+)=?(.*)$/);
    return m ? [m[1], m[2] || true] : [s, true];
  })
);

const out = path.resolve(args.out || 'work/shots/cover-preview.png');
const [W, H] = String(args.size || '377x212')
  .split('x')
  .map(Number);
const cells = String(args.cells || '')
  .split(',')
  .filter(Boolean)
  .map((p) => (path.isAbsolute(p) ? p : path.join(ROOT, p)));
const isHero = !!args.hero;
const title = args.title ? String(args.title) : '';
const en = args.en ? String(args.en) : '';

if (!cells.length) throw new Error('缺少 --cells');

const n = isHero ? 1 : cells.length;
const cellW = Math.floor((W - (n - 1) * 2) / n); // 2px 缝隙，与 UI 的 gap-0.5 一致

const layers = [];
for (let i = 0; i < n; i++) {
  const buf = await sharp(cells[i])
    // 与 CSS 的 object-cover 默认行为一致：居中裁切（不能用 attention 智能裁切，否则预演会骗人）
    .resize(cellW, H, { fit: 'cover', position: 'centre' })
    .toBuffer();
  layers.push({ input: buf, left: i * (cellW + 2), top: 0 });
}

// 压暗渐变（自下而上）+ 馆名
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#2b2119" stop-opacity="0.86"/>
      <stop offset="42%" stop-color="#2b2119" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#2b2119" stop-opacity="0.08"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  ${en ? `<text x="18" y="${H - 46}" font-family="Georgia,serif" font-size="9" letter-spacing="3" fill="#f4efe4" opacity="0.62">${esc(en)}</text>` : ''}
  ${title ? `<text x="18" y="${H - 22}" font-family="Microsoft YaHei,serif" font-size="20" font-weight="bold" fill="#f4efe4">${esc(title)}</text>` : ''}
</svg>`);

await sharp({
  create: { width: W, height: H, channels: 3, background: '#f4efe4' }
})
  .composite([...layers, { input: svg, left: 0, top: 0 }])
  .png()
  .toFile(out);

console.log('ok', path.relative(ROOT, out).replace(/\\/g, '/'), `${W}x${H} 每格 ${cellW}px`);
