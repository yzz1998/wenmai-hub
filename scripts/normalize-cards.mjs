/**
 * normalize-cards.mjs —— 全库统一卡片配图规格
 *
 * 目标：334 条条目各一张 960×720 (4:3) JPEG q82，供资源库统一网格展示。
 *
 * 两条不同的处理路径，因为两类图的性质不同：
 *   1) 剪纸图版（文献）→ contain 居中 + 纸色底，**绝不裁切**。团花是圆形构图，
 *      cover 会把四周纹样切掉，文献价值就没了。
 *   2) 实景照片（畲族 / 闽东 / 本次新取）→ cover 居中裁切，统一到 4:3。
 *
 * 原始文件一律不动：剪纸专题馆仍按 masonry 用原比例，只在资源库卡片层用统一规格。
 *
 * 输出：
 *   public/img/cards/<id>.jpg
 *   work/_cards-audit.json      （逐条规格审计：源尺寸 / 处理方式 / 是否放大 / 体积）
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PUB = path.join(ROOT, 'public');
const OUT_DIR = path.join(PUB, 'img', 'cards');
fs.mkdirSync(OUT_DIR, { recursive: true });

const W = 960;
const H = 720;
const INNER_W = 912;   // 剪纸留 24px 纸边
const INNER_H = 672;
const PAPER = '#f6f1e7';

const dataDir = path.join(ROOT, 'src', 'data');
const sources = ['papercut', 'she', 'mindong', 'hs-ch2', 'hs-ch5'];

const entries = [];
for (const f of sources) {
  const d = JSON.parse(fs.readFileSync(path.join(dataDir, `${f}.json`), 'utf8'));
  entries.push(...(d.entries || d));
}

const toPublicPath = (p) => path.join(PUB, String(p).replace(/^\/+/, ''));

const audit = [];
let ok = 0;
let skip = 0;

for (const e of entries) {
  const m = (e.media || [])[0];
  const raw = m && (m.full || m.src);
  if (!raw) {
    audit.push({ id: e.id, status: 'no-media' });
    skip++;
    continue;
  }
  if (/^(https?:|data:)/i.test(raw)) {
    audit.push({ id: e.id, status: 'remote', src: raw });
    skip++;
    continue;
  }
  const src = toPublicPath(raw);
  if (!fs.existsSync(src)) {
    // 有的数据写的是 thumb，full 不存在时回落 src
    const alt = m.src && toPublicPath(m.src);
    if (alt && fs.existsSync(alt)) {
      audit.push({ id: e.id, status: 'fallback-src', src: m.src });
    } else {
      audit.push({ id: e.id, status: 'missing-file', src: raw });
      skip++;
      continue;
    }
  }

  const usePath = fs.existsSync(src) ? src : toPublicPath(m.src);
  const meta = await sharp(usePath).metadata();
  const sw = meta.width || 0;
  const sh = meta.height || 0;
  const isPapercut = e.collection === 'papercut';
  const out = path.join(OUT_DIR, `${e.id}.jpg`);

  try {
    let pipe;
    if (isPapercut) {
      const inner = await sharp(usePath)
        .resize(INNER_W, INNER_H, { fit: 'contain', background: PAPER, withoutEnlargement: false })
        .flatten({ background: PAPER })
        .jpeg({ quality: 84 })
        .toBuffer();
      pipe = sharp(inner).extend({
        top: (H - INNER_H) / 2,
        bottom: (H - INNER_H) / 2,
        left: (W - INNER_W) / 2,
        right: (W - INNER_W) / 2,
        background: PAPER
      });
    } else {
      pipe = sharp(usePath).resize(W, H, { fit: 'cover', position: 'centre' });
    }

    const info = await pipe.flatten({ background: PAPER }).jpeg({ quality: 82, mozjpeg: true }).toFile(out);

    // 放大倍数：大于 1.6 说明源图偏小，画质会发虚，需要提示
    const scale = isPapercut
      ? Math.max(INNER_W / sw, INNER_H / sh)
      : Math.max(W / sw, H / sh);

    audit.push({
      id: e.id,
      collection: e.collection,
      status: 'ok',
      src: raw,
      srcW: sw,
      srcH: sh,
      mode: isPapercut ? 'contain' : 'cover',
      scale: Number(scale.toFixed(2)),
      bytes: info.size,
      out: `img/cards/${e.id}.jpg`
    });
    ok++;
  } catch (err) {
    audit.push({ id: e.id, status: 'error', src: raw, error: err.message });
    skip++;
  }
}

fs.writeFileSync(path.join(ROOT, 'work', '_cards-audit.json'), JSON.stringify(audit, null, 1));

const oks = audit.filter((a) => a.status === 'ok');
const total = oks.reduce((s, a) => s + a.bytes, 0);
const bigScale = oks.filter((a) => a.scale > 1.6);

console.log(`卡片图：成功 ${ok} / 共 ${entries.length}，跳过 ${skip}`);
console.log(`合计体积 ${(total / 1024 / 1024).toFixed(1)} MB，均 ${(total / oks.length / 1024).toFixed(0)} KB`);
console.log(`放大超过 1.6 倍（需注意画质）：${bigScale.length} 条`);
if (bigScale.length) console.log('  ' + bigScale.slice(0, 12).map((a) => `${a.id}(${a.scale}x)`).join(' '));

const problems = audit.filter((a) => a.status !== 'ok');
if (problems.length) {
  console.log(`\n非正常 ${problems.length} 条：`);
  for (const p of problems.slice(0, 20)) console.log('  ', p.id, p.status, p.src || p.error || '');
}
