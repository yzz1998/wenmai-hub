/**
 * audit-dupes.mjs —— 配图重复审计
 *
 * 两层查重，缺一不可：
 *   1) md5 —— 同一文件被两个条目引用（最硬的重复）
 *   2) dHash 汉明距离 —— 同一张图被裁成不同尺寸 / 二次压缩后重新落地，md5 变了但画面相同
 *
 * 上一轮闽东的教训：薛令之与廉村古渡两篇用了省文旅厅同一张图，
 * 文件名和 md5 都不同（一个裁过），只有算感知哈希才看得出来。
 *
 * 用法：node scripts/audit-dupes.mjs
 * 输出：work/_dupes.json
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = process.cwd();
const CARDS = path.join(ROOT, process.argv[2] || path.join('public', 'img', 'cover'));

const files = fs.readdirSync(CARDS).filter((f) => f.endsWith('.jpg'));

const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex');

/** 9×8 灰度差分哈希 → 64 bit hex */
async function dhash(p) {
  const { data } = await sharp(p)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const l = data[y * 9 + x];
      const r = data[y * 9 + x + 1];
      bits += l > r ? '1' : '0';
    }
  }
  return bits;
}

const hexToBits = (hex) => BigInt('0x' + hex).toString(2).padStart(64, '0');

function hamming(a, b) {
  const x = BigInt('0x' + a) ^ BigInt('0x' + b);
  let n = 0;
  let v = x;
  while (v > 0n) {
    n += Number(v & 1n);
    v >>= 1n;
  }
  return n;
}

const rows = [];
for (const f of files) {
  const p = path.join(CARDS, f);
  const buf = fs.readFileSync(p);
  const id = f.replace(/\.jpg$/, '');
  rows.push({ id, file: f, md5: md5(buf), bytes: buf.length, hash: await dhash(p) });
}

// 1) md5 硬重复
const byMd5 = {};
for (const r of rows) (byMd5[r.md5] ||= []).push(r.id);
const hardDupes = Object.entries(byMd5)
  .filter(([, ids]) => ids.length > 1)
  .map(([h, ids]) => ({ type: 'md5', md5: h, ids }));

// 2) 感知重复
const nearDupes = [];
for (let i = 0; i < rows.length; i++) {
  for (let j = i + 1; j < rows.length; j++) {
    if (rows[i].md5 === rows[j].md5) continue; // 已由 md5 覆盖
    const d = hamming(rows[i].hash, rows[j].hash);
    if (d <= 5) nearDupes.push({ type: 'phash', distance: d, ids: [rows[i].id, rows[j].id] });
  }
}

const out = { total: rows.length, hardDupes, nearDupes };
fs.writeFileSync(path.join(ROOT, 'work', '_dupes.json'), JSON.stringify({ ...out, rows }, null, 1));

console.log(`审计 ${rows.length} 张卡片图`);
console.log(`md5 完全相同：${hardDupes.length} 组`);
for (const d of hardDupes) console.log('  ', d.ids.join(' == '));
console.log(`感知高度相似（汉明距离 ≤5）：${nearDupes.length} 组`);
for (const d of nearDupes.slice(0, 25)) console.log(`   d=${d.distance}  ${d.ids.join(' ~ ')}`);
