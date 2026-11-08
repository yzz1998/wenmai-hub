/**
 * verify-online.mjs —— 对 334 条资源逐条联网检索，记录「该条主题在网络上能被找到什么」
 *
 * 目的不是替换图，而是把上一轮「凭判断决定沿用原图」变成可核查的记录：
 *   每条都有检索词、命中数、可信候选数、结论。
 *
 * 为什么保留原图也要检索：剪纸 241 条用的是《剪花娘子》图录图版，证据力高于任何网络图；
 * 但「不换」必须先证明「网络上确实没有更合适的东西」，否则就是偷懒。
 *
 * 输出：work/_verify.json（结论）+ work/_verify-raw.json（原始候选，改判定规则时可离线重算）
 */
import fs from 'node:fs';
import path from 'node:path';
import { searchAny, TRUST_HOSTS, DEFAULT_BLOCK, HARD_REJECT, hostOf, ROOT } from './lib/photo-fetch.mjs';

const DATA = path.join(ROOT, 'src', 'data');
const OUT = path.join(ROOT, 'work', '_verify.json');
const RAW = path.join(ROOT, 'work', '_verify-raw.json');
const OFFLINE = process.argv.includes('--offline');

const all = [];
for (const f of ['papercut.json', 'she.json', 'mindong.json', 'hs-ch2.json', 'hs-ch5.json']) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
  all.push(...(d.entries || d));
}

const covers = JSON.parse(fs.readFileSync(path.join(DATA, 'covers.json'), 'utf8')).items;

/** 标题清洗：把「无题（剪花娘子）」这类变成可检索的主题词 */
function cleanTitle(title = '') {
  const t = String(title).replace(/[·]/g, ' ').trim();
  const m = t.match(/^无题[（(](.+?)[）)]$/);
  if (m) return m[1];
  return t;
}

/** 按专题补语境词，避免「无题」这类标题检索出无关图 */
function buildQuery(e) {
  const t = cleanTitle(e.title);
  const words = [];
  if (e.collection === 'papercut') {
    words.push('库淑兰', '剪纸', t);
  } else if (e.collection === 'she') {
    words.push('畲族', t);
  } else if (e.collection === 'mindong') {
    words.push(t, '宁德');
  } else {
    words.push(t);
    const tag = (e.tags || [])[0];
    if (tag && !t.includes(tag)) words.push(tag);
  }
  return [...new Set(words.filter(Boolean))].join(' ');
}

const BLOCK = [...DEFAULT_BLOCK];
const isBlocked = (u) => {
  const h = hostOf(u);
  return !!h && BLOCK.some((b) => h.includes(b));
};
const isJunkTitle = (s) => HARD_REJECT.some((w) => String(s).includes(w));

/* 可信源白名单是对象数组 {re, w, name}：必须用正则匹配，
   上一版写成 h.includes(t) 会把对象转成 "[object Object]"，结果全判为不可信。 */
const isTrust = (u) => {
  const h = hostOf(u);
  return !!h && TRUST_HOSTS.some((t) => t.re.test(h));
};
const trustName = (u) => {
  const h = hostOf(u);
  const t = TRUST_HOSTS.find((x) => x.re.test(h));
  return t ? t.name : '';
};

const raw = OFFLINE && fs.existsSync(RAW) ? JSON.parse(fs.readFileSync(RAW, 'utf8')) : { queries: {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
let i = 0;
let fetched = 0;
let failedQueries = 0;

for (const e of all) {
  i++;
  const q = buildQuery(e);
  let res = raw.queries[q];

  if (!res) {
    if (OFFLINE) {
      res = [];
    } else {
      try {
        res = await searchAny(q, 40);
        raw.queries[q] = res;
        fetched++;
        await sleep(1100);
      } catch (err) {
        failedQueries++;
        console.log(`  ✗ ${e.id} 检索失败：${err.message}`);
        res = null;
        await sleep(2500);
      }
    }
  }

  const kind = (covers[e.id] || {}).kind || '';
  if (res === null) {
    out[e.id] = { query: q, hits: 0, usable: 0, verdict: '检索失败（限流），未能核验', kind };
    continue;
  }

  const usable = res.filter(
    (r) => r.purl && !isBlocked(r.purl) && !isJunkTitle(r.t) && !isBlocked(r.murl) && isTrust(r.purl)
  );
  const trusted = res.filter((r) => r.purl && isTrust(r.purl) && !isJunkTitle(r.t));
  const blocked = res.filter((r) => isBlocked(r.purl));

  let verdict;
  if (kind === 'web') verdict = '已采用联网图（本轮检索所得）';
  else if (usable.length >= 1) verdict = '有可信候选，未替换（原图可溯源）';
  else if (trusted.length >= 1) verdict = '仅命中小站转载，保留原图';
  else if (res.length === 0) verdict = '无命中，保留原图';
  else if (blocked.length >= res.length * 0.6) verdict = '命中多为素材站 / UGC 平台，保留原图';
  else verdict = '命中与主题不符（同类不同物 / 非实景），保留原图';

  // 只有「可信源」才配当候选示例：回退到 res[0] 会把素材站（如 dashangu）当成候选，误导读清单的人
  const best = usable[0] || trusted[0] || {};
  out[e.id] = {
    query: q,
    hits: res.length,
    usable: usable.length,
    trust: trustName(best.purl),
    top: best.purl || '',
    verdict,
    kind
  };

  if (i % 50 === 0) console.log(`  ${i}/${all.length} …`);
}

const summary = {};
for (const v of Object.values(out)) summary[v.verdict] = (summary[v.verdict] || 0) + 1;

if (!OFFLINE) fs.writeFileSync(RAW, JSON.stringify(raw));

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      total: all.length,
      uniqueQueries: Object.keys(raw.queries).length,
      fetchedThisRun: fetched,
      failedQueries,
      summary,
      entries: out
    },
    null,
    1
  )
);

console.log('\n完成：', all.length, '条，唯一检索词', Object.keys(raw.queries).length, '，失败', failedQueries);
console.log('结论分布：', JSON.stringify(summary, null, 1));
