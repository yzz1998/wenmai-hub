/**
 * fetch-round7.mjs —— 补一张：SHE-FESTIVAL-02「畲族婚俗」
 *
 * 去重审计发现，这条的配图（wedding/p040）与 SHE-CLOTH-01「凤凰装」（cloth/p001）
 * 是同一张图的副本（md5 完全一致），等于两个条目共用一张照片；
 * 而畲族 78 张照片已被其余 29 条全部引用，没有空闲图可换，只能重新联网取。
 */

import { runFetch } from './lib/photo-fetch.mjs';

const SHE_NOT = ['江西', '浙江', '广东', '广西', '贵州', '云南', '湖南', '会昌', '资溪', '景宁', '罗源'];

const FIX = {
  'SHE-FESTIVAL-02': {
    q: '畲族 婚俗 婚礼 新娘 福建',
    not: SHE_NOT,
    want: ['婚俗', '婚礼', '新娘', '嫁']
  }
};

for (const cfg of Object.values(FIX)) cfg.not = [...new Set([...(cfg.not || []), ...SHE_NOT])];

console.log('== 第 7 轮 · 目标 1 条 ==');
const summary = await runFetch({
  fix: FIX,
  round: 7,
  rawDir: 'cand7',
  minW: 760,
  minH: 520,
  maxPicks: 8
});

console.log('\n===== 第 7 轮汇总 =====');
for (const [id, st, prev] of summary) console.log(`  ${id}  ${st}  (旧候选 ${prev})`);
