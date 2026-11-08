/**
 * fetch-round5.mjs —— 最后一条：HS5-002 城市群 / 都市天际线
 *
 * 四轮都没成，原因很清楚：搜"城市群""都市天际线"返回的多是规划解读稿与付费图库，
 * 前三轮被词表过滤，第四轮抓到设图网（shetu66.com）的带水印下载图。
 * 这次直接换"一定能拍到"的建筑视角词。
 */

import { runFetch } from './lib/photo-fetch.mjs';

const COURSE_NOT = [
  '课件', '教案', '试题', '答案', '知识点', '思维导图', '流程图', '示意图',
  '图表', '题库', '试卷', '作业', '论文', '笔记', '讲义', '说课', '板书',
  '培训', '讲座', '会议', '论坛', '峰会', '签约', '揭牌'
];

const FIX = {
  'HS5-002': {
    q: '摩天大楼 玻璃幕墙 仰拍 中央商务区',
    not: COURSE_NOT,
    want: ['摩天', '幕墙', '商务区', '大楼']
  }
};

console.log('== 第 5 轮 · 目标 1 条 ==');
const summary = await runFetch({
  fix: FIX,
  round: 5,
  rawDir: 'cand5',
  minW: 800,
  minH: 560,
  maxPicks: 8
});

console.log('\n===== 第 5 轮汇总 =====');
for (const [id, st, prev] of summary) console.log(`  ${id}  ${st}  (旧候选 ${prev})`);
