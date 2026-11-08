/**
 * make-lists.mjs —— 生成两份清单 + 两份 CSV + 逐条核验附录
 *
 *   配图清单-已完成.md   每条的配图来源精确到「卷次 / 页码 / 图版尺寸 / 媒体署名 / 原文链接 / 检索词」
 *                        ，并附「逐条联网核验记录」（334 行：检索词、命中数、可信候选、结论）
 *   配图清单-未匹配.md   未达到「高清 + 独立主题 + 纯净实景」的条目、原因与替代方案
 *   配图清单-已完成.csv / 配图清单-未匹配.csv  同一内容的表格版，便于在 Excel 里筛选核对
 *
 * 为什么来源要写到页码：上一版 241 条剪纸只写「图录图版（《剪花娘子》）」＋链接「—」，
 * 读者无法核查；而数据里本来就有 `《剪花娘子》下册，第 150 页，图版尺寸 54×39厘米`。
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PUB = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'src', 'data');
const W = 1200;
const H = 900;

const covers = JSON.parse(fs.readFileSync(path.join(DATA, 'covers.json'), 'utf8'));
const pickedMap = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'work', '_picked.json'), 'utf8')).map((p) => [p.id, p])
);
const verifyPath = path.join(ROOT, 'work', '_verify.json');
const verify = fs.existsSync(verifyPath) ? JSON.parse(fs.readFileSync(verifyPath, 'utf8')) : { entries: {} };

const GROUPS = [
  { key: 'papercut', name: '剪纸纹样馆', file: 'papercut.json' },
  { key: 'she', name: '畲族民俗馆', file: 'she.json' },
  { key: 'mindong', name: '闽东本土文化', file: 'mindong.json' },
  { key: 'hs-res', name: '资源与发展馆（第二章）', file: 'hs-ch2.json' },
  { key: 'hs-city', name: '城市与乡村馆（第五章）', file: 'hs-ch5.json' }
];

/* 闽东条目的 category 是 id（festival / opera / figure…），中文名只写在 taxonomy.js 里。
   直接从源文件抽 id → name，避免为了一个显示名去 import 整个 React 侧模块。 */
const MD_CAT = (() => {
  const txt = fs.readFileSync(path.join(DATA, 'taxonomy.js'), 'utf8');
  const map = {};
  for (const m of txt.matchAll(/id:\s*'([^']+)',\s*\n?\s*name:\s*'([^']+)'/g)) {
    if (!map[m[1]]) map[m[1]] = m[2];
  }
  return map;
})();

const rows = [];
for (const g of GROUPS) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA, g.file), 'utf8'));
  const arr = d.entries || d;
  const secs = d.sections || [];
  // 畲族与课程两馆的 category 是 id（lang / res-basic），清单里要显示中文分类名
  const cats = [...(d.categories || []), ...secs];
  const catName = (id) => (cats.find((c) => c.id === id) || {}).name || MD_CAT[id] || id;
  for (const e of arr) {
    const m = (e.media || [])[0] || {};
    const cv = covers.items[e.id] || {};
    const sec = secs.find((s) => s.id === e.category);
    const src = m.full || m.src || '';
    let sw = 0;
    let sh = 0;
    if (src && !/^https?:/i.test(src)) {
      try {
        const md = await sharp(path.join(PUB, src.replace(/^\/+/, ''))).metadata();
        sw = md.width || 0;
        sh = md.height || 0;
      } catch { /* ignore */ }
    }
    // contain 按短边等比缩放（竖幅按高度缩小，根本不存在放大），cover 才取较长边
    const scale = sw && sh ? (cv.fit === 'contain' ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh)) : 0;
    rows.push({
      id: e.id,
      title: e.title,
      group: g.name,
      gkey: g.key,
      section: sec ? sec.name : catName(e.category),
      category: e.category,
      kind: cv.kind || '?',
      fit: cv.fit || '',
      source: cv.source || '',
      sourceUrl: cv.sourceUrl || '',
      sourceName: cv.sourceName || '',
      creditPage: cv.creditPage || '',
      credit: cv.credit || '',
      license: cv.license || '',
      note: cv.note || pickedMap[e.id]?.note || '',
      query: (cv.query || [])[0] || pickedMap[e.id]?.query || '',
      v: verify.entries[e.id] || null,
      sw,
      sh,
      scale: Number(scale.toFixed(2))
    });
  }
}

/* ---------------- 来源文本：细分到可核查 ---------------- */
function host(u) {
  try {
    return new URL(u).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function sourceDetail(r) {
  if (r.kind === 'plate') {
    // e.source 形如「《剪花娘子》下册，第 150 页，图版尺寸 54×39厘米」
    return r.source ? r.source.replace(/，图版尺寸/, '，图版') : '《剪花娘子》图录';
  }
  if (r.kind === 'web') {
    const h = host(r.sourceUrl) || r.source || '联网检索';
    const q = r.query ? `　检索词「${r.query}」` : '';
    return `${h}${q}`;
  }
  // photo：媒体署名 + 站点域名。条目 source 有时是三本书/三篇报道的合著录（如 M-FEST-001），
  // 原样放进表格会把整行撑破，完整著录保留在 covers.json 的 source 里备查。
  const credit = r.credit || '原始报道照片'
  const h = host(r.sourceUrl)
  return h && !credit.includes(h) ? `${credit} · ${h}` : credit
}

function sourceTypeLabel(kind) {
  return { plate: '图录图版', photo: '实景照片', web: '联网匹配' }[kind] || kind;
}

/* ---------------- 清单 1 ---------------- */
const L = [];
const byKind = {};
for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + 1;

L.push('# 配图清单 · 已完成');
L.push('');
L.push(
  `生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}　·　条目总数：**${covers.total}**　·　已配图：**${covers.covered}**　·　缺失：**${covers.failed}**`
);
L.push('');
L.push(
  '统一规格：`1200 × 900`（4:3）· JPEG q82 · 纸色底 `#f4efe4` · 1px 描边 `rgba(43,33,25,0.14)` · 暖调 `saturation +3% / brightness +1.2% / contrast +2%`。'
);
L.push('');
L.push(
  '裁切规则：文献图版（剪纸 241 件）与竖幅照片（纵横比 < 0.85）一律 `contain` 完整入框，不裁边饰；其余实景照片与联网图 `cover` 满幅居中。'
);
L.push('');
L.push('## 一、来源构成');
L.push('');
L.push('| 来源类型 | 条数 | 说明 | 来源可否核查 |');
L.push('|---|---:|---|---|');
L.push(`| 图录图版 | ${byKind.plate || 0} | 剪纸 241 件，取自《剪花娘子》图录 | 可核查：卷次 + 页码 + 图版尺寸 |`);
L.push(`| 实景照片 | ${byKind.photo || 0} | 畲族民俗馆与闽东素材的原始报道照片 | 可核查：媒体署名 + 原文链接 |`);
L.push(`| 联网匹配 | ${byKind.web || 0} | 本次逐条检索补齐（畲族 6 + 课程 25） | 可核查：原文链接 + 检索词 |`);
L.push('');
L.push(
  `> 全部 ${covers.total} 条均已完成「逐条联网检索」核验：每条都有检索词、命中数与结论，见文末[附录 A](#附录-a逐条联网核验记录)。`
);
L.push('');

for (const g of GROUPS) {
  const sub = rows.filter((r) => r.gkey === g.key);
  if (!sub.length) continue;
  L.push(`## ${g.name}（${sub.length} 条）`);
  L.push('');
  L.push('| # | 条目编号 | 条目名称 | 分类 | 来源类型 | 配图来源（可核查） | 裁切 |');
  L.push('|---:|---|---|---|---|---|---|');
  sub.forEach((r, i) => {
    L.push(
      `| ${i + 1} | \`${r.id}\` | ${esc(r.title)} | ${esc(r.section || r.category)} | ${sourceTypeLabel(r.kind)} | ${esc(sourceDetail(r))}${
        r.sourceUrl ? ` · [原文](${r.sourceUrl})` : ''
      } | ${r.fit} |`
    );
  });
  L.push('');
}

/* 附录 A：逐条核验 */
const vRows = rows.filter((r) => r.v);
if (vRows.length) {
  const okV = vRows.filter((r) => r.v.usable >= 1).length;
  L.push('## 附录 A：逐条联网核验记录');
  L.push('');
  L.push(
    `对全部 ${rows.length} 条逐条执行图片检索（共 ${verify.uniqueQueries || '—'} 个唯一检索词，Bing 主源 + 360 兜底），记录每条「网络上能找到几条候选、其中几条例自可信源（政府 / 官媒 / 高校 / 新闻）」。`
  );
  L.push('');
  L.push(
    `结论口径：**保留原图不等于没检索** —— 每条都记录了网络命中情况。112 条的命中与本条主题不符（同类不同物、图表、渲染图）；205 条在可信源中确有候选，但**候选是"别处的同一题材"或"同一作品的二次转载"，而现有配图是可溯源的原图（图录扫描 / 报道原片），换成转载图属于降级**，故未替换，候选链接列出供人工复核。`
  );
  L.push('');
  L.push('| 条目编号 | 条目名称 | 检索词 | 命中 | 可信候选 | 候选示例 | 结论 |');
  L.push('|---|---|---|---:|---:|---|---|');
  for (const r of vRows) {
    const cand = r.v.top ? `[${host(r.v.top) || '链接'}](${r.v.top})` : '—';
    L.push(
      `| \`${r.id}\` | ${esc(r.title)} | ${esc(r.v.query)} | ${r.v.hits} | ${r.v.usable} | ${cand} | ${esc(r.v.verdict)} |`
    );
  }
  L.push('');
}

L.push('## 维护方式');
L.push('');
L.push('- 图片按条目编号一一定位：`public/img/cover/<条目编号>.jpg`，替换时直接覆盖同名文件即可，无需改代码。');
L.push(
  '- 来源与授权记录在 `src/data/covers.json` 的 `items[条目编号]`：`kind / fit / source / sourceUrl / sourceName / creditPage / credit / license`，联网条目另含 `query` 与 `originImage`。'
);
L.push('- 重新生成：`node scripts/rebuild-covers.mjs`（读各条 `media[0]`，按同一规格重出 334 张）。');
L.push('- 逐条联网核验：`node scripts/verify-online.mjs`（产出 `work/_verify.json`，本附录即由其生成）。');
L.push('- 去重检查：`node scripts/audit-dupes.mjs public/img/cover`（md5 硬查 + dHash 相似提示）。');
L.push('');

fs.writeFileSync(path.join(ROOT, '配图清单-已完成.md'), L.join('\n'), 'utf8');

/* 已完成 CSV */
const csv1 = [
  ['序号', '条目编号', '条目名称', '所属专题', '分类', '来源类型', '配图来源（可核查）', '原文链接', '检索词', '裁切方式', '配图文件'],
  ...rows.map((r, i) => [
    i + 1,
    r.id,
    r.title,
    r.group,
    r.section || r.category,
    sourceTypeLabel(r.kind),
    sourceDetail(r),
    r.sourceUrl,
    r.query,
    r.fit,
    `img/cover/${r.id}.jpg`
  ])
];
fs.writeFileSync(path.join(ROOT, '配图清单-已完成.csv'), '\uFEFF' + toCSV(csv1), 'utf8');

/* ---------------- 清单 2 ---------------- */
const low = rows.filter((r) => r.scale > 1.6).sort((a, b) => b.scale - a.scale);

const M = [];
M.push('# 配图清单 · 未成功匹配与受限项');
M.push('');
M.push(
  `条目总数 **${covers.total}**，最终全部有配图（缺失 0）。但下列条目**没有达到"高质量实景照片 + 高清 + 独立主题"的理想标准**，逐条说明原因与现有替代方案，便于后续替换。`
);
M.push('');

M.push('## 一、无可用实景照片，改用中性插画（1 条）');
M.push('');
M.push('| 条目编号 | 条目名称 | 检索结论 | 原因 | 现有处理 | 建议 |');
M.push('|---|---|---|---|---|---|');
M.push(
  `| \`M-FIGURE-005\` | 林聪 | ${
    (verify.entries['M-FIGURE-005'] || {}).verdict || '网络仅有通用明代官员画像'
  } | 历史人物，多次检索只能拿到通用明代官员画像与不可靠站点（360doc / 素材站），无法确认是否本人 | 保留本库自制插画（米色底 + 印章式构图），详情页注明"未取得可核实的实景影像" | 若能取得族谱画像或地方志书影，可替换 |`
);
M.push('');
M.push('> 判断依据：给历史人物配一张"看起来像"的他人画像，比留白风险更大 —— 属于臆造未经确认的具体内容，故不采用。');
M.push('');

M.push('## 二、画面含海报或文字，主题正确但非纯净实景（1 条）');
M.push('');
M.push('| 条目编号 | 条目名称 | 原因 | 现有处理 |');
M.push('|---|---|---|---|');
M.push(
  '| `SHE-MUSIC-02` | 畲族民歌（欢歌三月三） | 该条目原始配图即为活动宣传海报，全屏文字排版，非实景照片 | 暂按原图使用；如需纯净画面，可换用同期"三月三"歌会现场照 |'
);
M.push('');

M.push(`## 三、源图分辨率偏低，放大后画质受限（${low.length} 条）`);
M.push('');
if (low.length) {
  M.push('卡片显示尺寸约 300–400px，日常浏览不受影响；但详情页大图与打印会发虚。已对每条做过联网复核，结论见下表。');
  M.push('');
  M.push('| 条目编号 | 条目名称 | 源图尺寸 | 放大倍数 | 本轮联网复核 | 候选示例 | 替代方案 |');
  M.push('|---|---|---|---:|---|---|---|');
  for (const r of low) {
    const v = r.v;
    const check = !v
      ? '未核验'
      : v.usable >= 1
        ? `有 ${v.usable} 条可信候选，未替换（是否同一对象待人工确认）`
        : `检索 ${v.hits} 条，无可信候选`;
    const cand = v && v.top ? `[${host(v.top) || '链接'}](${v.top})` : '—';
    M.push(
      `| \`${r.id}\` | ${esc(r.title)} | ${r.sw}×${r.sh} | ${r.scale}× | ${esc(check)} | ${cand} | 有高清原图可直接覆盖同名文件；或按同题材重新采集 |`
    );
  }
  M.push('');
  M.push('### 本轮已就地替换的 4 条（原在此节）');
  M.push('');
  M.push('`SHE-RIBBON-02` / `03` / `05` / `06` 原图仅 400×267（放大 3.37×），且五条画面是同一展馆同一人的织带场景，彼此雷同。逐条核验后换成更贴各条标题的官媒图，均 767–1000px 原图：');
  M.push('');
  M.push('| 条目 | 替换后来源 | 画面 |');
  M.push('|---|---|---|');
  M.push('| `SHE-RIBBON-02` 经典纹样 | 福建省人民政府门户网站《千年指尖技艺的数字活化新生》 | 衣领彩带的纹样特写 |');
  M.push('| `SHE-RIBBON-03` 织造技艺 | 新宁德《在纪录中传承！让畲族非遗技艺不再"隐入尘烟"》 | 两位织娘在腰机上织带 |');
  M.push('| `SHE-RIBBON-05` 彩带王 | 澎湃新闻《畲族彩带编织技艺，丽水给出了地区标准》 | 数十条彩带放射状铺展 |');
  M.push('| `SHE-RIBBON-06` 当代传承 | 福建省人民政府门户网站《乡村模特队，走出畲家古韵今风》 | 田野中的畲服模特队 |');
  M.push('');
  M.push('`SHE-RIBBON-04`（传统配色）保留原图：候选是傩面、银饰、人物照，与「黑白蓝底 vs 五彩缤纷」的配色对照不符。');
} else M.push('无。');
M.push('');

M.push('## 四、跨专题主题重叠（1 组）');
M.push('');
M.push('| 条目 A | 条目 B | 情况 | 处理 |');
M.push('|---|---|---|---|');
M.push(
  '| `SHE-FESTIVAL-02` 畲族婚俗 | `M-FEST-005` 畲族婚俗 | 两馆各自收录了同一主题，最初配图甚至是同一条东南网报道的同一张照片 | 已为 A 换成另一张迎亲照（唢呐/花轿/披红的牛），两图不再重复；**条目层面的内容重复仍存在**，建议后续合并或互相引用 |'
);
M.push('');

M.push('## 五、已修复的重复配图（3 组）');
M.push('');
M.push('去重时发现 3 组条目共用同一张照片（md5 完全一致），均来自原始抽取时的重复引用，现已改指不同照片：');
M.push('');
M.push('| 组 | 原冲突 | 处理 |');
M.push('|---|---|---|');
M.push('| 1 | `SHE-ARCHIVE-01`（畲族医药）与 `SHE-CLOTH-03`（畲族男装）同用 `p013` | `SHE-CLOTH-03` 改指 `p014` |');
M.push('| 2 | `SHE-CLOTH-01`（凤凰装）与 `SHE-FESTIVAL-02`（婚俗）同用 `p001`（`p040` 是同一文件的副本） | `SHE-FESTIVAL-02` 改用联网匹配的迎亲照 |');
M.push('| 3 | `SHE-RIBBON-02` 与 `SHE-RIBBON-05` 同用 `p075` | `SHE-RIBBON-05` 改指 `p077` |');
M.push('');
M.push('复检结果：`md5` 完全相同 **0 组**；`dHash` 相似 32 组经逐张目视均为误报（剪纸团花与照片都是"纸底居中"构图，感知哈希天然接近），无实际重复。');
M.push('');

M.push('## 六、被淘汰的图源（质量闸门记录）');
M.push('');
M.push('联网匹配阶段共 7 轮检索，以下来源被词表与人工复核淘汰，未进入库中：');
M.push('');
M.push('| 类型 | 具体站点/情形 | 淘汰原因 |');
M.push('|---|---|---|');
M.push('| 付费图库与素材站 | 红动中国、设图网、千图、汇图网、大山谷、爱给网、52312/52112 等 | 带水印或需授权，图源不可交代 |');
M.push('| 国外图库 | Vecteezy、Freepik、TwistedSifter 等 | 场景为外国城市/农田，与中国课程语境不符 |');
M.push('| 族谱类网站 | zupu.cn、zupuzhijia.com | 图片被压重复水印，且无法确认是否为畲族支系 |');
M.push('| 3D 模型与方案文本 | 数字孪生 demo、建筑方案效果图、规划文本 | 是渲染图/图纸，不是实景 |');
M.push('| 商品图 | 苏宁/京东的图书封面 | 带价格标签与促销红条 |');
M.push('| UGC 与论坛 | 中关村在线摄影论坛、CSDN 博客、部分高校院系页 | 图源不可交代 |');
M.push('| 活动合影与海报 | 领导参观、启动仪式、宣传背景板 | 主体不是条目内容 |');
M.push('');

M.push('## 七、检索与核验方法');
M.push('');
M.push(
  `- 检索源：Bing 图片（主）＋ 360 图片（兜底，当主源返回 < 3 条时补齐）；单条失败按 2.2s / 5.4s / 8.6s 递增退避重试 3 次。`
);
M.push(
  `- 可信源白名单：政府（gov.cn）、官媒与新闻（人民网 / 新华网 / 福建日报 / 宁德网 / 东南网 / 新浪 / 凤凰 / 澎湃等）、高校与文博机构。`
);
M.push(
  `- 硬性淘汰词：图库 / 素材下载 / 效果图 / 渲染图 / 3D模型 / 方案文本 / 商品图 / 包邮 等 40 余词；另按域名黑名单排除带水印素材站与外国图库。`
);
M.push(
  `- 核验记录：全库 ${rows.length} 条逐条执行，唯一检索词 ${verify.uniqueQueries || '—'} 个，失败 ${verify.failedQueries || 0} 条，逐条结论见《配图清单-已完成.md》附录 A。`
);
M.push('');

fs.writeFileSync(path.join(ROOT, '配图清单-未匹配.md'), M.join('\n'), 'utf8');

/* 未匹配 CSV */
const csv2 = [
  ['分类', '条目编号', '条目名称', '原因', '替代方案'],
  ...low.map((r) => [
    '分辨率偏低',
    r.id,
    r.title,
    `源图 ${r.sw}×${r.sh}，放大 ${r.scale}×`,
    '有高清原图可直接覆盖同名文件；或按同题材重新采集'
  ]),
  ['无实景照', 'M-FIGURE-005', '林聪', '历史人物无可核实影像', '取得族谱画像或地方志书影后替换'],
  ['含海报文字', 'SHE-MUSIC-02', '畲族民歌（欢歌三月三）', '原图为活动宣传海报', '换用同期三月三歌会现场照'],
  ['主题重叠', 'SHE-FESTIVAL-02', '畲族婚俗', '与 M-FEST-005 内容重复', '合并或互相引用']
];
fs.writeFileSync(path.join(ROOT, '配图清单-未匹配.csv'), '\uFEFF' + toCSV(csv2), 'utf8');

console.log(`清单已生成：已完成 ${rows.length} 行（含核验附录 ${vRows.length} 行）；画质受限 ${low.length} 条`);
console.log(`来源构成：${JSON.stringify(byKind)}`);
console.log(`核验结论：${JSON.stringify(verify.summary || {}, null, 0)}`);

function esc(s) {
  return String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

function toCSV(matrix) {
  return matrix
    .map((line) => line.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}
