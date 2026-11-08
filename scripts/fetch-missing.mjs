/**
 * fetch-missing.mjs —— 为 30 条缺图条目联网检索候选配图
 *
 * 检索词原则（课程条目尤其重要）：
 *   不搜抽象名词（「资源的内涵」「S 形曲线」→ 会搜出图表、PPT、课件），
 *   改搜该概念在现实中**可以被拍到的东西**（森林矿藏、风机光伏、矿坑、烟囱、收割机……）。
 *   畲族条目要注意「同名异地」：搜「畲族三月三」首条常是江西会昌的，必须排除外省。
 *
 * 用法：
 *   node scripts/fetch-missing.mjs                 # 第一轮
 *   node scripts/fetch-missing.mjs 2               # 第二轮（round=2，独立 rawDir）
 *   node scripts/fetch-missing.mjs 2 SHE-LANG-01   # 只重抓指定条目
 */

import { runFetch } from './lib/photo-fetch.mjs';

/** 课件/教辅类词 —— 课程条目最容易踩的坑，命中直接重罚 */
const COURSE_NOT = [
  '课件', '教案', '试题', '答案', '知识点', '思维导图', '流程图', '示意图',
  '图表', '题库', '试卷', '作业', '论文', '笔记', '讲义', '说课', '板书',
  '培训', '讲座', '会议', '论坛', '峰会', '签约', '揭牌'
];

/** 畲族同名异地 —— 江西会昌、浙江景宁、福建罗源都有畲族，只有闽东的可用 */
const SHE_NOT = [
  '江西', '浙江', '广东', '广西', '贵州', '云南', '湖南', '湖北', '安徽', '四川',
  '会昌', '资溪', '泰顺', '景宁', '丽水', '罗源', '漳州', '泉州', '龙岩三洲'
];

const FIX = {
  /* ---------------- 畲族民俗馆：5 条 ---------------- */
  'SHE-LANG-01': {
    q: '畲族 村寨 山哈 福建 宁德',
    not: SHE_NOT,
    want: ['村寨', '村落', '全景', '航拍', '宁德', '福安', '霞浦']
  },
  'SHE-LANG-02': {
    q: '畲族 族谱 宗谱 手抄 文献',
    not: SHE_NOT,
    want: ['族谱', '宗谱', '文献', '手抄']
  },
  'SHE-LANG-03': {
    q: '畲族 祠堂 宗祠 蓝姓 雷姓',
    not: SHE_NOT,
    want: ['祠堂', '宗祠', '祖堂']
  },
  'SHE-LANG-04': {
    q: '畲族 山歌 对唱 歌会',
    not: SHE_NOT,
    want: ['山歌', '对唱', '歌会', '歌言']
  },
  'SHE-CRAFT-04': {
    q: '木拱廊桥 寿宁 鸾峰桥 福建',
    not: SHE_NOT,
    want: ['廊桥', '木拱', '寿宁', '屏南', '周宁']
  },

  /* ---------------- 第二章：资源与发展（12 条） ---------------- */
  'HS2-001': {
    q: '自然资源 森林 矿产 土地 航拍',
    not: COURSE_NOT,
    want: ['森林', '矿山', '航拍', '自然']
  },
  'HS2-002': {
    q: '风力发电 光伏 太阳能 电站',
    not: COURSE_NOT,
    want: ['风机', '光伏', '太阳能', '电站']
  },
  'HS2-003': {
    q: '湿地 河流 山川 自然保护 全景',
    not: COURSE_NOT,
    want: ['湿地', '河流', '山川', '全景']
  },
  'HS2-004': {
    q: '科研 实验室 高校 人才 教育',
    not: COURSE_NOT,
    want: ['实验室', '科研', '高校']
  },
  'HS2-005': {
    q: '煤矿 油田 天然气 能源 开采',
    not: COURSE_NOT,
    want: ['煤矿', '油田', '天然气', '开采']
  },
  'HS2-006': {
    q: '城市 人流 拥挤 人口 密集',
    not: COURSE_NOT,
    want: ['人流', '人口', '密集']
  },
  'HS2-007': {
    q: '露天矿 采矿场 矿坑 开采',
    not: COURSE_NOT,
    want: ['露天矿', '矿坑', '采矿']
  },
  'HS2-008': {
    q: '工厂 烟囱 排放 工业 污染',
    not: COURSE_NOT,
    want: ['烟囱', '排放', '污染']
  },
  'HS2-009': {
    q: '寂静的春天 蕾切尔 卡森',
    not: COURSE_NOT,
    want: ['寂静的春天', '卡森', '环保']
  },
  'HS2-010': {
    q: '生态 湿地 白鹭 自然 保护',
    not: COURSE_NOT,
    want: ['湿地', '白鹭', '生态']
  },
  'HS2-011': {
    q: '垃圾分类 回收 再生资源',
    not: COURSE_NOT,
    want: ['垃圾分类', '回收', '再生']
  },
  'HS2-012': {
    q: '塞罕坝 林场 生态文明 造林',
    not: COURSE_NOT,
    want: ['塞罕坝', '林场', '造林']
  },

  /* ---------------- 第五章：城市与乡村（13 条） ---------------- */
  'HS5-001': {
    q: '古城遗址 城墙 考古 发掘',
    not: COURSE_NOT,
    want: ['古城', '遗址', '城墙', '考古']
  },
  'HS5-002': {
    q: '城市群 天际线 航拍 都市',
    not: COURSE_NOT,
    want: ['天际线', '航拍', '都市', '城市群']
  },
  'HS5-003': {
    q: '城市化 高层建筑 密集 街区',
    not: COURSE_NOT,
    want: ['高层', '街区', '城市']
  },
  'HS5-004': {
    q: '新城 住宅区 建设 郊区',
    not: COURSE_NOT,
    want: ['新城', '住宅', '建设']
  },
  'HS5-005': {
    q: '中国 城市 天际线 深圳 上海',
    not: COURSE_NOT,
    want: ['深圳', '上海', '天际线', '中国']
  },
  'HS5-006': {
    q: '交通拥堵 城市 车流 高峰',
    not: COURSE_NOT,
    want: ['拥堵', '车流', '交通']
  },
  'HS5-007': {
    q: '稻田 梯田 农耕 水田',
    not: COURSE_NOT,
    want: ['稻田', '梯田', '水田', '农耕']
  },
  'HS5-008': {
    q: '牛耕 铁犁 传统 农耕',
    not: COURSE_NOT,
    want: ['牛耕', '铁犁', '耕作']
  },
  'HS5-009': {
    q: '联合收割机 机械化 农田 收割',
    not: COURSE_NOT,
    want: ['收割机', '机械化', '收割']
  },
  'HS5-010': {
    q: '乡村 老屋 村庄 中国传统村落',
    not: COURSE_NOT,
    want: ['村落', '老屋', '村庄', '古村']
  },
  'HS5-011': {
    q: '工业遗产 老厂房 蒸汽机车',
    not: COURSE_NOT,
    want: ['工业遗产', '厂房', '蒸汽']
  },
  'HS5-012': {
    q: '流水线 车间 制造 工厂',
    not: COURSE_NOT,
    want: ['流水线', '车间', '制造']
  },
  'HS5-013': {
    q: '城乡 交界 城市 农田 航拍',
    not: COURSE_NOT,
    want: ['城乡', '交界', '农田']
  }
};

const round = Number(process.argv[2] || 1);
const only = process.argv.slice(3);

// 合并通用排除词：课程类与畲族类各按来源加一遍
const courseIds = Object.keys(FIX).filter((id) => id.startsWith('HS'));
for (const [id, cfg] of Object.entries(FIX)) {
  const extra = id.startsWith('HS') ? COURSE_NOT : SHE_NOT;
  cfg.not = [...new Set([...(cfg.not || []), ...extra])];
}

const target = only.length ? Object.fromEntries(Object.entries(FIX).filter(([id]) => only.includes(id))) : FIX;

console.log(`== 第 ${round} 轮 · 目标 ${Object.keys(target).length} 条 ==`);
const summary = await runFetch({
  fix: target,
  round,
  rawDir: `cand${round}`,
  minW: 800,
  minH: 560,
  maxPicks: 8
});

const ok = summary.filter((s) => s[1].startsWith('新候选'));
const bad = summary.filter((s) => !s[1].startsWith('新候选'));
console.log(`\n== 汇总：成功 ${ok.length} / ${summary.length} ==`);
if (bad.length) for (const [id, st] of bad) console.log('  未成功:', id, st);
console.log('courseIds', courseIds.length);
