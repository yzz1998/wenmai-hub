/**
 * patch-media.mjs —— 把联网匹配到的 30 张配图写回数据文件
 *
 * 写入字段与既有闽东素材保持同一套结构（media[0] 的 credit/creditPage/creditTitle），
 * 这样详情页的「图源」标注、引用与替换逻辑都不需要为新课条目另写分支。
 *
 * 只动 work/_picked.json 里列出的条目，其余条目（剪纸 241 / 畲族已配图 25 / 闽东 38）原样不动。
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const picked = JSON.parse(fs.readFileSync(path.join(ROOT, 'work', '_picked.json'), 'utf8'));
const byId = Object.fromEntries(picked.map((p) => [p.id, p]));

const FILES = ['she.json', 'hs-ch2.json', 'hs-ch5.json'];
const dataDir = path.join(ROOT, 'src', 'data');

let changed = 0;
const report = [];

for (const f of FILES) {
  const fp = path.join(dataDir, f);
  const raw = fs.readFileSync(fp, 'utf8');
  const d = JSON.parse(raw);
  const arr = d.entries || d;
  let hit = 0;

  for (const e of arr) {
    const p = byId[e.id];
    if (!p) continue;
    const had = (e.media || []).length > 0;
    e.media = [
      {
        src: p.src,
        full: p.src,
        w: 960,
        h: 720,
        kind: 'photo',
        credit: p.origin.site || '网络公开图片',
        creditPage: p.origin.page || '',
        creditTitle: p.origin.title || '',
        alt: e.title,
        note: p.note
      }
    ];
    // 保留已有的 image 字段（闽东条目用它做二级引用），不覆盖
    hit++;
    changed++;
    report.push({ id: e.id, file: f, replaced: had, credit: p.origin.site, note: p.note });
  }

  fs.writeFileSync(fp, JSON.stringify(d, null, 2) + '\n');
  console.log(`${f}: 写入 ${hit} 条`);
}

fs.writeFileSync(path.join(ROOT, 'work', '_patch-report.json'), JSON.stringify(report, null, 1));
console.log(`\n合计写入 ${changed} 条`);

// 复查：全库还有多少条没配图
let missing = [];
for (const f of ['papercut.json', 'she.json', 'mindong.json', 'hs-ch2.json', 'hs-ch5.json']) {
  const d = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
  const arr = d.entries || d;
  for (const e of arr) if (!(e.media && e.media.length && e.media[0].src)) missing.push(e.id);
}
console.log(`全库仍无配图：${missing.length} 条${missing.length ? ' -> ' + missing.join(', ') : '（0 缺失）'}`);
