/**
 * apply-selection.mjs —— 把人工复核选定的候选落地为正式配图
 *
 * 输入：.img-staging/selection.json
 *   { "HS2-001": { "pick": 3, "note": "露天矿坑航拍" }, ... }
 *
 * 输出：
 *   public/img/matched/<ID>.jpg      统一 960×720 JPEG q82
 *   work/_picked.json                逐条来源留档（原图地址 / 来源页 / 站点 / 原标题 / 源尺寸）
 *
 * 为什么集中放 img/matched/：维护时一眼能区分「网检配图」与「图录图版」「原报道照片」，
 * 替换或回退只需动这一个目录，不会污染既有的 img/papercut、img/she、img/real。
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'img', 'matched');
fs.mkdirSync(OUT_DIR, { recursive: true });

const selPath = path.join(ROOT, '.img-staging', 'selection.json');
if (!fs.existsSync(selPath)) {
  console.error('缺少 .img-staging/selection.json');
  process.exit(1);
}
const selection = JSON.parse(fs.readFileSync(selPath, 'utf8'));
const pool = JSON.parse(fs.readFileSync(path.join(ROOT, '.img-staging', 'candidates.json'), 'utf8'));

const picked = [];
const failed = [];

for (const [id, cfg] of Object.entries(selection)) {
  const rec = pool[id];
  if (!rec) {
    failed.push({ id, reason: '候选池无此条目' });
    continue;
  }
  const p = rec.picks[cfg.pick];
  if (!p) {
    failed.push({ id, reason: `候选序号 ${cfg.pick} 不存在（共 ${rec.picks.length} 张）` });
    continue;
  }
  const src = path.join(ROOT, p.file);
  if (!fs.existsSync(src)) {
    failed.push({ id, reason: '候选文件已丢失' });
    continue;
  }
  const out = path.join(OUT_DIR, `${id}.jpg`);
  // 竖版文物照（如畲族祖杖 1600×2400）用 contain + 纸底，横向 cover 会把主体截断
  let pipe;
  if (cfg.fit === 'contain') {
    const inner = await sharp(src)
      .resize(912, 672, { fit: 'contain', background: '#f6f1e7' })
      .flatten({ background: '#f6f1e7' })
      .jpeg({ quality: 86 })
      .toBuffer();
    pipe = sharp(inner).extend({ top: 24, bottom: 24, left: 24, right: 24, background: '#f6f1e7' });
  } else {
    pipe = sharp(src).resize(960, 720, { fit: 'cover', position: cfg.align || 'centre' });
  }
  const info = await pipe
    .flatten({ background: '#f6f1e7' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(out);

  picked.push({
    id,
    src: `img/matched/${id}.jpg`,
    bytes: info.size,
    note: cfg.note || '',
    query: rec.query,
    origin: {
      img: p.murl,
      page: p.purl,
      site: p.trust,
      title: p.title,
      w: p.w,
      h: p.h
    }
  });
  console.log(`  ✓ ${id}  ${p.trust}  ${(info.size / 1024).toFixed(0)}KB  ${cfg.note || ''}`);
}

fs.writeFileSync(path.join(ROOT, 'work', '_picked.json'), JSON.stringify(picked, null, 1));

console.log(`\n落地 ${picked.length} 张，失败 ${failed.length} 条`);
for (const f of failed) console.log('  ✗', f.id, f.reason);
