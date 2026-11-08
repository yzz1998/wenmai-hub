/**
 * sheet.mjs —— 候选配图拼版（人工复核闸门）
 *
 * 上一轮闽东取图的经验：只看候选列表没用，必须把图拼起来逐张目视，
 * 否则「选中的那张其实题材不对」这种问题根本发现不了。
 *
 * 用法：
 *   node scripts/sheet.mjs --ids=HS2-001,HS2-002 --per=6
 *   node scripts/sheet.mjs --round=1 --from=0 --count=4     # 按候选池顺序取 4 条
 *
 * 输出：.img-staging/sheets/<label>.png
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const STAGE = path.join(ROOT, '.img-staging');
const OUT = path.join(STAGE, 'sheets');
fs.mkdirSync(OUT, { recursive: true });

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  return m ? m.split('=')[1] : d;
};

const CELL_W = 300;
const CELL_H = 225;
const GAP = 8;
const HEAD = 30;   // 条目标题行
const FOOT = 26;   // 候选序号/来源行
const PAD = 12;

const candPath = path.join(STAGE, 'candidates.json');
const pool = JSON.parse(fs.readFileSync(candPath, 'utf8'));

let ids = arg('ids', '').split(',').filter(Boolean);
if (!ids.length) {
  const from = Number(arg('from', 0));
  const count = Number(arg('count', 4));
  ids = Object.keys(pool).slice(from, from + count);
}

const per = Number(arg('per', 6));
const label = arg('label', ids[0] + (ids.length > 1 ? `-等${ids.length}条` : ''));

const rows = [];
for (const id of ids) {
  const rec = pool[id];
  if (!rec || !rec.picks || !rec.picks.length) {
    rows.push({ id, missing: true, picks: [] });
    continue;
  }
  rows.push({ id, query: rec.query, picks: rec.picks.slice(0, per) });
}

const maxCols = Math.max(per, ...rows.map((r) => r.picks.length));
const width = PAD * 2 + maxCols * CELL_W + (maxCols - 1) * GAP;
const rowH = HEAD + CELL_H + FOOT + GAP;
const height = PAD * 2 + rows.length * rowH;

const base = sharp({
  create: { width, height, channels: 3, background: '#ffffff' }
});

const layers = [];
const svgText = [];
let y = PAD;
let n = 0;

for (const row of rows) {
  // 条目标题
  svgText.push(
    `<text x="${PAD}" y="${y + 20}" font-family="Microsoft YaHei,Segoe UI" font-size="16" font-weight="700" fill="#111">${escapeXml(row.id)}　${escapeXml(row.query || '(无候选)')}</text>`
  );
  const cy = y + HEAD;
  for (let i = 0; i < row.picks.length; i++) {
    const p = row.picks[i];
    const cx = PAD + i * (CELL_W + GAP);
    const file = path.join(ROOT, p.file);
    try {
      const buf = await sharp(file)
        .resize(CELL_W, CELL_H, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 80 })
        .toBuffer();
      layers.push({ input: buf, left: cx, top: cy });
      n++;
      // 序号徽标
      svgText.push(
        `<rect x="${cx}" y="${cy}" width="26" height="22" fill="#000" opacity="0.72"/>`,
        `<text x="${cx + 7}" y="${cy + 17}" font-family="Segoe UI" font-size="15" font-weight="700" fill="#fff">${i}</text>`,
        `<rect x="${cx}" y="${cy + CELL_H}" width="${CELL_W}" height="${FOOT}" fill="#111" opacity="0.82"/>`,
        `<text x="${cx + 6}" y="${cy + CELL_H + 18}" font-family="Microsoft YaHei,Segoe UI" font-size="11" fill="#fff">${escapeXml(`${p.w}x${p.h} ${p.trust}`.slice(0, 30))}</text>`
      );
    } catch {
      svgText.push(
        `<rect x="${cx}" y="${cy}" width="${CELL_W}" height="${CELL_H}" fill="#f2f2f2"/>`,
        `<text x="${cx + 10}" y="${cy + 30}" font-family="Segoe UI" font-size="13" fill="#999">load fail</text>`
      );
    }
  }
  y += rowH;
}

const overlay = Buffer.from(
  `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgText.join('')}</svg>`
);

const out = path.join(OUT, `${sanitize(label)}.png`);
await base.composite([...layers, { input: overlay, left: 0, top: 0 }]).png().toFile(out);

const missing = rows.filter((r) => r.missing).map((r) => r.id);
console.log(`sheet -> ${path.relative(ROOT, out).replace(/\\/g, '/')}  (${width}x${height}, ${n} 张候选)`);
if (missing.length) console.log('无候选条目:', missing.join(', '));

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}
function sanitize(s) {
  return String(s).replace(/[\\/:*?"<>|]/g, '_').slice(0, 90);
}
