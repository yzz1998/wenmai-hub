/**
 * rebuild-covers.mjs —— 重建 334 张标准配图与 covers.json
 *
 * 规格沿用既有定义（保持站点视觉不变）：
 *   1200×900 / JPEG q82 / 纸色底 #f4efe4 / 1px 描边 rgba(43,33,25,0.14)
 *   统一暖调：saturation +3% · brightness +1.2% · contrast +2%
 *
 * 与上一版（work/make-covers.cjs）的区别：源不再取独立候选池，而是统一取各条 media[0]，
 * 因此本轮 31 张经严格词表筛出的官媒图会自然覆盖进来，旧的素材站图（红动中国/设图网/
 * vecteezy/freepik 等）随之被替换掉。
 *
 * 分类规则：
 *   papercut            → plate   （图录图版，contain 完整入框，绝不裁边饰）
 *   竖版 ar < 0.85       → contain （文物、竖幅建筑照不横向截断）
 *   其余                → cover   （实景照片满幅）
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PUB = path.join(ROOT, 'public');
const OUT = path.join(PUB, 'img', 'cover');
const DATA = path.join(ROOT, 'src', 'data');

const W = 1200;
const H = 900;
const Q = 82;
const PAPER = { r: 244, g: 239, b: 228, alpha: 1 };

fs.mkdirSync(OUT, { recursive: true });

const FRAME = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="rgba(43,33,25,0.14)" stroke-width="1"/></svg>`
);

const picked = fs.existsSync(path.join(ROOT, 'work', '_picked.json'))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, 'work', '_picked.json'), 'utf8'))
  : [];
const pickedMap = Object.fromEntries(picked.map((p) => [p.id, p]));

const entries = [];
for (const f of ['papercut.json', 'she.json', 'mindong.json', 'hs-ch2.json', 'hs-ch5.json']) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
  entries.push(...(d.entries || d));
}

const items = {};
const failed = [];
let done = 0;
let bytes = 0;

for (const e of entries) {
  const m = (e.media || [])[0];
  const rel = m && (m.full || m.src);
  if (!rel) {
    failed.push({ id: e.id, title: e.title, reason: '无配图来源' });
    continue;
  }
  if (/^(https?:|data:)/i.test(rel)) {
    failed.push({ id: e.id, title: e.title, reason: '远程地址未落地：' + rel });
    continue;
  }
  const src = path.join(PUB, rel.replace(/^\/+/, ''));
  if (!fs.existsSync(src)) {
    failed.push({ id: e.id, title: e.title, reason: '文件不存在：' + rel });
    continue;
  }

  try {
    const meta = await sharp(src).metadata();
    const ar = (meta.width || 1) / (meta.height || 1);
    const isPlate = e.collection === 'papercut';
    const fit = isPlate || ar < 0.85 ? 'contain' : 'cover';

    const pipe = sharp(src)
      .rotate()
      .resize(W, H, fit === 'cover'
        ? { fit: 'cover', position: 'centre', kernel: 'lanczos3' }
        : { fit: 'contain', position: 'centre', background: PAPER, kernel: 'lanczos3' });

    const buf = await pipe
      .flatten({ background: PAPER })
      .modulate({ saturation: 1.03, brightness: 1.012 })
      .linear(1.02, -2)
      .toBuffer();

    const outBuf = await sharp(buf)
      .composite([{ input: FRAME }])
      .jpeg({ quality: Q, progressive: true, mozjpeg: true })
      .toBuffer();

    fs.writeFileSync(path.join(OUT, `${e.id}.jpg`), outBuf);
    bytes += outBuf.length;
    done++;

    /* 来源字段要「可核查」：版本 + 页码 + 图版尺寸 + 原文链接，缺一不可。
       上一版只写「原图录图版」，清单里 300 多行来源是「—」，等于没有来源。 */
    const p = pickedMap[e.id];
    const facets = e.facets || {};
    const vol = facets.vol ? `${facets.vol}册` : '';
    const plateCite =
      e.source ||
      `《剪花娘子》${vol}${facets.page ? `，第 ${facets.page} 页` : ''}${
        facets.size ? `，图版尺寸 ${facets.size}` : ''
      }`;
    const pageLink = e.sourceUrl || (Array.isArray(e.links) && e.links[0] ? e.links[0][1] : '') || '';

    let rec;
    if (isPlate) {
      rec = {
        cover: `img/cover/${e.id}.jpg`,
        kind: 'plate',
        fit,
        title: e.title,
        collection: e.collection,
        source: plateCite,
        sourceUrl: '',
        sourceName: '《剪花娘子》图录',
        creditPage: facets.page || '',
        credit: m.credit || '图版来源：《剪花娘子》图录',
        license: '原始项目文献图版'
      };
    } else if (p) {
      rec = {
        cover: `img/cover/${e.id}.jpg`,
        kind: 'web',
        fit,
        title: e.title,
        collection: e.collection,
        source: p.origin.site || '联网检索',
        sourceUrl: p.origin.page || '',
        credit: p.origin.title || '',
        license: '第三方媒体图片，教学引用；正式出版需另行取得授权',
        query: [p.query],
        note: p.note || '',
        originImage: p.origin.img || ''
      };
    } else {
      rec = {
        cover: `img/cover/${e.id}.jpg`,
        kind: m.source ? 'web' : 'photo',
        fit,
        title: e.title,
        collection: e.collection,
        // 图片级出处优先于条目级：替换过配图的条目，来源应指向这张图自己的报道页
        source: m.source || e.source || m.credit || '原实景照片',
        sourceUrl: m.creditPage || pageLink,
        credit: m.credit || '',
        note: m.source ? '联网替换：原图分辨率偏低或主题不够贴合' : '',
        license: m.source ? '第三方媒体图片，教学引用；正式出版需另行取得授权' : '原始项目实景照片（来源见 credit）'
      };
    }
    items[e.id] = rec;
  } catch (err) {
    failed.push({ id: e.id, title: e.title, reason: err.message.slice(0, 80) });
  }
}

const manifest = {
  generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
  spec: {
    width: W,
    height: H,
    format: 'jpeg',
    quality: Q,
    background: '#f4efe4',
    frame: 'rgba(43,33,25,0.14) 1px',
    tone: 'saturation +3% / brightness +1.2% / contrast +2%'
  },
  total: entries.length,
  covered: done,
  failed: failed.length,
  items
};

fs.writeFileSync(path.join(DATA, 'covers.json'), JSON.stringify(manifest, null, 1));
fs.writeFileSync(path.join(ROOT, 'work', '_covers-failed.json'), JSON.stringify(failed, null, 1));

const byKind = {};
const byFit = {};
for (const v of Object.values(items)) {
  byKind[v.kind] = (byKind[v.kind] || 0) + 1;
  byFit[`${v.kind}/${v.fit}`] = (byFit[`${v.kind}/${v.fit}`] || 0) + 1;
}

console.log(`生成 ${done} / ${entries.length}，失败 ${failed.length}`);
console.log(`总体积 ${(bytes / 1024 / 1024).toFixed(1)} MB，均 ${Math.round(bytes / Math.max(1, done) / 1024)} KB`);
console.log('来源构成：', JSON.stringify(byKind));
console.log('裁切方式：', JSON.stringify(byFit));
failed.forEach((f) => console.log('  失败', f.id, f.reason));
