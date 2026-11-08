/**
 * fetch-round6.mjs —— 收尾两条
 *
 * SHE-LANG-02「从畲字看命名」：四轮族谱图全带族谱网站水印（zupu.cn / zupuzhijia.com
 *   在图上压了重复水印），不可用。改从"族称落在实景上"取图：畲族村门楼/村名牌。
 *   注意与 SHE-LANG-01 错开：那条用山村全景，这条用带村名的门楼。
 *
 * HS5-002「城市的发展阶段与功能」：五轮失败。前四轮是规划稿与付费图库，
 *   第五轮抓到爱给网（aigei.com）的"8K 16:9 仰拍"描述，属素材站合成图，不可用。
 *   改按城市名直接检索地标建筑群，避免"城市群/天际线"这类会被方案文本淹没的词。
 */

import { runFetch } from './lib/photo-fetch.mjs';

const SHE_NOT = ['江西', '浙江', '广东', '广西', '贵州', '云南', '湖南', '会昌', '资溪', '景宁', '罗源'];

const COURSE_NOT = [
  '课件', '教案', '试题', '答案', '知识点', '思维导图', '流程图', '示意图',
  '图表', '题库', '试卷', '作业', '论文', '笔记', '讲义', '说课', '板书',
  '培训', '讲座', '会议', '论坛', '峰会', '签约', '揭牌', '免费下载', '千图', '包图'
];

const FIX = {
  'SHE-LANG-02': {
    q: '畲族村 门楼 牌坊 村名 福建',
    not: SHE_NOT,
    want: ['畲族村', '门楼', '牌坊', '村口']
  },
  'HS5-002': {
    q: '广州 珠江新城 摩天大楼 建筑群',
    not: COURSE_NOT,
    want: ['珠江新城', '摩天', '建筑群']
  }
};

for (const [id, cfg] of Object.entries(FIX)) {
  const extra = id.startsWith('HS') ? COURSE_NOT : [];
  cfg.not = [...new Set([...(cfg.not || []), ...extra])];
}

console.log(`== 第 6 轮 · 目标 ${Object.keys(FIX).length} 条 ==`);
const summary = await runFetch({
  fix: FIX,
  round: 6,
  rawDir: 'cand6',
  minW: 760,
  minH: 520,
  maxPicks: 8
});

console.log('\n===== 第 6 轮汇总 =====');
for (const [id, st, prev] of summary) console.log(`  ${id}  ${st}  (旧候选 ${prev})`);
