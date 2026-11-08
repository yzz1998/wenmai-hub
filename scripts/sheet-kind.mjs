/**
 * sheet-kind.mjs —— 按来源类型抽样拼版
 *
 * 334 张全看一眼不现实，按来源分层抽样：
 *   web   —— 本轮联网匹配的 31 张，必须逐张看（唯一的新内容）
 *   plate —— 剪纸图录 241 张，抽 12 张确认 contain 未裁边饰
 *   photo —— 畲族/闽东原照片 62 张，抽 12 张确认 cover 裁切正常
 *
 * 用法：node scripts/sheet-kind.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'public', 'img', 'cover');
const OUT = path.join(ROOT, '.img-staging', 'sheets');
fs.mkdirSync(OUT, { recursive: true });

const covers = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'covers.json'), 'utf8')).items;

const byKind = { plate: [], photo: [], web: [] };
for (const [id, v] of Object.entries(covers)) (byKind[v.kind] ||= []).push(id);

async function render(ids, per, label, cw = 280, ch = 210) {
  const rows = Math.ceil(ids.length / per);
  const G = 6;
  const LAB = 22;
  const PAD = 10;
  const W = PAD * 2 + per * cw + (per - 1) * G;
  const H = PAD * 2 + rows * (ch + LAB + G);
  const layers = [];
  const svg = [];
  let i = 0;
  for (const id of ids) {
    const c = i % per;
    const r = Math.floor(i / per);
    const x = PAD + c * (cw + G);
    const y = PAD + r * (ch + LAB + G);
    try {
      const buf = await sharp(path.join(DIR, `${id}.jpg`)).resize(cw, ch, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
      layers.push({ input: buf, left: x, top: y });
    } catch { /* skip */ }
    svg.push(`<text x="${x + 4}" y="${y + ch + 15}" font-family="Microsoft YaHei" font-size="11" fill="#111">${id}</text>`);
    i++;
  }
  const file = path.join(OUT, `${label}.png`);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
    .composite([...layers, { input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${svg.join('')}</svg>`), left: 0, top: 0 }])
    .png()
    .toFile(file);
  console.log(`${label}: ${ids.length} 张 -> ${path.relative(ROOT, file).replace(/\\/g, '/')} (${W}x${H})`);
}

// 1) 全部 31 张联网图
await render(byKind.web.sort(), 8, 'cover-web', 260, 195);

// 2) 分层抽样
const pick = (arr, n) => {
  const step = Math.max(1, Math.floor(arr.length / n));
  return arr.filter((_, i) => i % step === 0).slice(0, n);
};
await render([...pick(byKind.plate, 12), ...pick(byKind.photo, 12)], 6, 'cover-sample', 280, 210);
