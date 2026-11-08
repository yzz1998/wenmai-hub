/**
 * patch-cards.mjs —— 给每条 media[0] 挂上统一规格卡片图地址
 *
 * 分工：
 *   media[0].src    原始图（剪纸图版原比例、畲族/闽东原照片）—— 专题馆与详情页仍用它
 *   media[0].card   960×720 统一卡片图 —— 资源库网格、管理页缩略图用它
 *
 * 这样做的好处：资源库 334 张卡片的尺寸与留白规则完全一致，
 * 而剪纸专题馆的瀑布流仍按原始竖版比例陈列，策展逻辑不被削平。
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CARDS = path.join(ROOT, 'public', 'img', 'cards');
const dataDir = path.join(ROOT, 'src', 'data');

const files = ['papercut.json', 'she.json', 'mindong.json', 'hs-ch2.json', 'hs-ch5.json'];

let total = 0;
let missingCard = [];

for (const f of files) {
  const fp = path.join(dataDir, f);
  const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const arr = d.entries || d;
  let n = 0;
  for (const e of arr) {
    const m = (e.media || [])[0];
    if (!m || !m.src) continue;
    const rel = `img/cards/${e.id}.jpg`;
    if (!fs.existsSync(path.join(CARDS, `${e.id}.jpg`))) {
      missingCard.push(e.id);
      continue;
    }
    m.card = rel;
    n++;
    total++;
  }
  fs.writeFileSync(fp, JSON.stringify(d, null, 2) + '\n');
  console.log(`${f.padEnd(14)} 挂 card ${n} 条`);
}

console.log(`\n合计 ${total} 条`);
if (missingCard.length) console.log(`缺卡片图 ${missingCard.length} 条: ${missingCard.slice(0, 10).join(', ')}`);
