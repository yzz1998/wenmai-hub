/**
 * fetch-round3.mjs —— 第三轮定向补抓
 *
 * 第二轮后仍缺或候选不可用的条目。换词原则：把「抽象概念」换成「一定能拍到的具体物」。
 *
 * 无候选的 6 条，共同点是一轮词太"新闻化"（城市群/新城镇/城乡交界），
 * 命中的多是政策解读稿，配图全是规划图与方案文本，被过滤后一张不剩。
 * 改法：直接用**地标名**或**实物名**，让搜索引擎给实景照片。
 */

import { runFetch } from './lib/photo-fetch.mjs';

const COURSE_NOT = [
  '课件', '教案', '试题', '答案', '知识点', '思维导图', '流程图', '示意图',
  '图表', '题库', '试卷', '作业', '论文', '笔记', '讲义', '说课', '板书',
  '培训', '讲座', '会议', '论坛', '峰会', '签约', '揭牌'
];

const FIX = {
  /* 畲族：祠堂搜不到，改搜畲族特有的宗族文物「祖图」（连环画卷，学界常引） */
  'SHE-LANG-03': {
    q: '畲族 祖图 祖杖 文物',
    not: ['江西', '浙江', '广东', '广西', '贵州', '会昌', '资溪', '景宁', '罗源'],
    want: ['祖图', '祖杖', '畲族']
  },

  /* 人口压力 → 不再搜"人口"这种抽象词，改用密度极高的实景 */
  'HS2-006': {
    q: '地铁站 早高峰 乘客 人流',
    not: COURSE_NOT,
    want: ['地铁', '人流', '早高峰', '乘客']
  },

  /* 工业排放 → 火力发电厂冷却塔是最典型的可拍对象 */
  'HS2-008': {
    q: '火力发电厂 冷却塔 烟囱 航拍',
    not: COURSE_NOT,
    want: ['冷却塔', '烟囱', '电厂']
  },

  /* 思想史条目：书封商品图不可用，改搜作者肖像 */
  'HS2-009': {
    q: '蕾切尔 卡森 肖像 环保 先驱',
    not: COURSE_NOT,
    want: ['卡森', '蕾切尔', '肖像']
  },

  'HS5-002': {
    q: '高楼 建筑群 航拍 城市 全景',
    not: COURSE_NOT,
    want: ['建筑群', '航拍', '全景']
  },

  'HS5-003': {
    q: '城市 密集 居民楼 航拍',
    not: COURSE_NOT,
    want: ['居民楼', '密集', '航拍']
  },

  'HS5-005': {
    q: '陆家嘴 天际线 黄浦江 上海',
    not: COURSE_NOT,
    want: ['陆家嘴', '天际线', '黄浦江']
  },

  'HS5-007': {
    q: '梯田 水稻 插秧 稻田',
    not: COURSE_NOT,
    want: ['梯田', '水稻', '插秧', '稻田']
  },

  /* 工业革命 → 用现代生产线实景，而非 3D 模型 demo */
  'HS5-012': {
    q: '汽车 生产线 机器人 焊接 车间',
    not: COURSE_NOT,
    want: ['生产线', '机器人', '焊接', '总装']
  },

  'HS5-013': {
    q: '城市 郊区 农田 菜地 航拍',
    not: COURSE_NOT,
    want: ['郊区', '农田', '菜地', '航拍']
  }
};

for (const [id, cfg] of Object.entries(FIX)) {
  const extra = id.startsWith('HS') ? COURSE_NOT : [];
  cfg.not = [...new Set([...(cfg.not || []), ...extra])];
}

console.log(`== 第 3 轮 · 目标 ${Object.keys(FIX).length} 条 ==`);
const summary = await runFetch({
  fix: FIX,
  round: 3,
  rawDir: 'cand3',
  minW: 800,
  minH: 560,
  maxPicks: 8
});

console.log('\n===== 第 3 轮汇总 =====');
for (const [id, st, prev] of summary) console.log(`  ${id.padEnd(14)} ${st}  (旧候选 ${prev})`);
