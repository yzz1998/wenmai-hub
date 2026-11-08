/**
 * fetch-round4.mjs —— 第四轮：最后 5 条
 *
 * 前三轮仍不成的，原因各不相同，逐条换思路：
 *   HS2-008 电厂冷却塔：两轮无候选，改搜钢铁厂高炉（同样是"排放"的典型可拍对象）
 *   HS2-009 卡森肖像：搜不到可用肖像，改「地球卫星照」—— 对应该条「从警示到全球议程」的主线
 *   HS5-002 城市群：只搜到设图网的付费下载图，改搜都市夜景灯光
 *   HS5-013 城乡交界：只拿到一张纯菜地航拍，缺"城市"对照，改搜城乡结合部
 *   SHE-LANG-02 族谱：搜到的古籍页无法确认是畲族，改按四姓（蓝/雷）精确检索
 */

import { runFetch } from './lib/photo-fetch.mjs';

const COURSE_NOT = [
  '课件', '教案', '试题', '答案', '知识点', '思维导图', '流程图', '示意图',
  '图表', '题库', '试卷', '作业', '论文', '笔记', '讲义', '说课', '板书',
  '培训', '讲座', '会议', '论坛', '峰会', '签约', '揭牌'
];

const FIX = {
  'SHE-LANG-02': {
    q: '畲族 蓝姓 族谱 宗谱 福建',
    not: ['江西', '浙江', '广东', '广西', '贵州', '会昌', '资溪', '景宁', '罗源'],
    want: ['蓝姓', '族谱', '宗谱', '畲族']
  },
  'HS2-008': {
    q: '钢铁厂 高炉 烟囱 工业 全景',
    not: COURSE_NOT,
    want: ['高炉', '烟囱', '钢厂']
  },
  'HS2-009': {
    q: '地球 卫星照片 蓝色星球 云层 NASA',
    not: COURSE_NOT,
    want: ['地球', '卫星', '蓝色星球']
  },
  'HS5-002': {
    q: '都市 夜景 高楼 灯光 天际线',
    not: COURSE_NOT,
    want: ['夜景', '灯光', '天际线']
  },
  'HS5-013': {
    q: '城乡结合部 菜地 高楼 村庄',
    not: COURSE_NOT,
    want: ['城乡', '菜地', '高楼']
  }
};

for (const [id, cfg] of Object.entries(FIX)) {
  const extra = id.startsWith('HS') ? COURSE_NOT : [];
  cfg.not = [...new Set([...(cfg.not || []), ...extra])];
}

console.log(`== 第 4 轮 · 目标 ${Object.keys(FIX).length} 条 ==`);
const summary = await runFetch({
  fix: FIX,
  round: 4,
  rawDir: 'cand4',
  minW: 760,
  minH: 520,
  maxPicks: 8
});

console.log('\n===== 第 4 轮汇总 =====');
for (const [id, st, prev] of summary) console.log(`  ${id.padEnd(14)} ${st}  (旧候选 ${prev})`);
