/**
 * sheet-cands.mjs —— 把「逐条核验」里某几条的候选图拼成一张看一眼的图
 *
 * 为什么需要：未匹配清单里「非同一作品 / 主题不符」这类判断，不看图就是猜。
 * 只有把候选真正下载下来拼在一起，才能决定「换」还是「不换」。
 *
 * 用法：node scripts/sheet-cands.mjs --ids=SHE-RIBBON-02,SHE-RIBBON-03 --per=6 --out=ribbon.png
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { TRUST_HOSTS, DEFAULT_BLOCK, HARD_REJECT, hostOf, ROOT } from './lib/photo-fetch.mjs';

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split('=')[1] : d;
};
const IDS = arg('ids', '').split(',').filter(Boolean);
const PER = Number(arg('per', 6));
const OUT = path.join(ROOT, 'work', 'sheet', arg('out', 'cands.png'));

const verify = JSON.parse(fs.readFileSync(path.join(ROOT, 'work', '_verify.json'), 'utf8')).entries;
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'work', '_verify-raw.json'), 'utf8')).queries;

const isBlocked = (u) => {
  const h = hostOf(u);
  return !!h && DEFAULT_BLOCK.some((b) => h.includes(b));
};
const isTrust = (u) => {
  const h = hostOf(u);
  return !!h && TRUST_HOSTS.some((t) => t.re.test(h));
};
const isJunk = (s) => HARD_REJECT.some((w) => String(s).includes(w));

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function grab(u, referer) {
  try {
    const r = await fetch(u, {
      headers: { 'User-Agent': UA, Referer: referer || u, Accept: 'image/*' },
      signal: AbortSignal.timeout(12000)
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const md = await sharp(buf).metadata();
    if (!md.width || md.width < 360) return null;
    return { buf, w: md.width, h: md.height };
  } catch {
    return null;
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });

const CW = 320;
const CH = 240;
const LB = 34;
const rows = [];

for (const id of IDS) {
  const v = verify[id];
  if (!v) continue;
  const cands = (raw[v.query] || [])
    .filter((c) => c.purl && isTrust(c.purl) && !isBlocked(c.purl) && !isJunk(c.t))
    .slice(0, PER);
  const cells = [];
  for (const c of cands) {
    const img = await grab(c.murl, c.purl);
    if (!img) continue;
    cells.push({ ...img, host: hostOf(c.purl), url: c.purl });
  }
  if (cells.length) rows.push({ id, title: '', cells });
  console.log(`${id}：${cands.length} 候选，下载成 ${cells.length}`);
}

if (!rows.length) {
  console.log('没有可用候选');
  process.exit(0);
}

const cols = Math.max(...rows.map((r) => r.cells.length));
const W = cols * CW;
const H = rows.length * (CH + LB);
const parts = [];

for (let ri = 0; ri < rows.length; ri++) {
  const r = rows[ri];
  for (let ci = 0; ci < r.cells.length; ci++) {
    const c = r.cells[ci];
    const left = ci * CW;
    const top = ri * (CH + LB);
    let img;
    try {
      img = await sharp(c.buf).resize(CW - 4, CH - 4, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
      parts.push({ input: img, left: left + 2, top: top + 2 });
    } catch {
      continue;
    }
    const label = await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${LB}"><rect width="${CW}" height="${LB}" fill="#fff"/><text x="6" y="14" font-size="12" fill="#111" font-family="Arial">${r.id} #${ci}  ${c.w}x${c.h}</text><text x="6" y="28" font-size="11" fill="#666" font-family="Arial">${c.host}</text></svg>`
      )
    )
      .png()
      .toBuffer();
    parts.push({ input: label, left, top: top + CH - 2 });
  }
}

await sharp({ create: { width: W, height: H, channels: 3, background: '#f2f2f2' } })
  .composite(parts)
  .png()
  .toFile(OUT);

console.log('拼版：', OUT);
