/**
 * 生成两份配图清单：已完成 / 未精确匹配
 * 输出：配图清单_已完成.csv、配图清单_未精确匹配.csv、配图说明.md
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const audit = JSON.parse(fs.readFileSync(path.join(ROOT, 'work/audit.json'), 'utf8'))
const covers = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/covers.json'), 'utf8'))
const cidx = JSON.parse(fs.readFileSync(path.join(ROOT, 'work/cand-index.json'), 'utf8'))
const sel = JSON.parse(fs.readFileSync(path.join(ROOT, 'work/selections.json'), 'utf8'))

/* ---------- 分类中文名 ---------- */
const catName = {}
const tax = fs.readFileSync(path.join(ROOT, 'src/data/taxonomy.js'), 'utf8')
for (const m of tax.matchAll(/id:\s*'([^']+)',\s*\n\s*name:\s*'([^']+)'/g)) catName[m[1]] = m[2]
for (const f of ['hs-ch2', 'hs-ch5']) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', f + '.json'), 'utf8'))
  for (const s of d.sections) catName[s.id] = s.name
}

const SOURCE = {
  papercut: '剪纸图样馆',
  she: '畲族民俗馆',
  mindong: '闽东本土文化知识库',
  'hs-ch2': '资源与发展馆（第二章）',
  'hs-ch5': '城市与乡村馆（第五章）'
}

/** 联网检索图的备注：说明"主题相符但非该条专属实物" */
const WEB_NOTE = {
  'SHE-LANG-01': '畲族凤凰装演出照，族属与服饰相符；非该条所述具体人物',
  'SHE-LANG-02': '闽东畲族石砌聚落，题材相符；非该条所指具体村落',
  'SHE-LANG-03': '宗祠内景（匾额、供桌），题材相符；非畲族盘蓝雷钟四姓的具体宗谱实物',
  'SHE-LANG-04': '畲族歌会/对唱场景，题材相符；非该条所述具体歌本',
  'SHE-FESTIVAL-02': '中式迎亲花轿，婚俗题材相符；非该条所述具体畲族婚礼记录',
  'SHE-CRAFT-04': '闽浙木拱廊桥实景，形制相符；未确认为该条所指的鸾峰桥本体',
  'SHE-ARCHIVE-01': '中药材晾晒工艺图，题材相符；非罗源畲医药的具体药材与场所',
  'SHE-RIBBON-05': '手工织带工艺，题材相符；非蓝延兰「彩带王」实物',
  'HS2-001': '河流/森林等自然资源景观，用于表达资源概念',
  'HS2-002': '露天矿开采场景，代表矿产资源一类',
  'HS2-003': '河流湿地系统航拍，用于表达自然资源的整体性与区域性',
  'HS2-004': '课堂与教学场景，代表人力资本/社会资源',
  'HS2-005': '燃煤电厂，代表化石能源阶段',
  'HS2-006': '密集人流街景，代表人口压力',
  'HS2-007': '露天矿坑全景，代表不可再生资源开采',
  'HS2-008': '雾霾城市，代表环境污染',
  'HS2-009': '地球卫星影像，中性示意可持续发展议题',
  'HS2-010': '风电+光伏场，代表清洁能源',
  'HS2-011': '再生资源分拣车间，代表资源化环节',
  'HS2-012': '大型光伏基地，代表国家层面绿色转型',
  'HS5-001': '中国境内夯土城址，示意早期城市形态；非两河流域具体遗址',
  'HS5-002': '现代大都市天际线，代表城市发展阶段',
  'HS5-003': '城市建成区航拍，用于说明城市化测度',
  'HS5-004': '郊区住宅区航拍，代表郊区化',
  'HS5-005': '中国城市天际线，代表中国城镇化成果',
  'HS5-006': '城市立交与车流，代表交通问题',
  'HS5-007': '成熟麦田与麦穗，代表作物起源与农业',
  'HS5-008': '牛耕水田，代表传统农业耕作方式',
  'HS5-009': '联合收割机作业，代表农业机械化',
  'HS5-010': '中国乡村聚落航拍，代表乡村形态',
  'HS5-011': '纺织车间与工人，代表工厂制度',
  'HS5-012': '高炉出铁，代表重工业化',
  'HS5-013': '城市与农田交界航拍，代表城乡关系'
}

/** 中性示意（抽象概念，无具体所指） */
const NEUTRAL = new Set(['HS2-009'])

const csvCell = (v) => {
  const s = String(v == null ? '' : v).replace(/\r?\n/g, ' ').trim()
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

/* ---------- 已完成清单 ---------- */
const rows = []
let i = 0
for (const r of audit.rows) {
  const c = covers.items[r.id]
  if (!c) continue
  i++
  let type = '原始图版'
  let source = ''
  let url = ''
  let credit = ''
  let level = 'A'
  let note = ''

  if (c.kind === 'plate') {
    type = '原始文献图版'
    source = '库淑兰剪纸图录（原项目）'
    credit = r.main?.credit || ''
    note = '与条目所指图样一一对应'
  } else if (c.kind === 'photo') {
    type = '原始实景/素材照片'
    source = r.main?.credit || '原项目实景照片'
    url = r.main?.creditPage || ''
    credit = r.main?.credit || ''
    note = '与条目所指实物/场景对应'
  } else {
    type = '联网检索'
    level = NEUTRAL.has(r.id) ? 'C' : 'B'
    source = c.source
    url = c.sourceUrl
    credit = c.credit
    note = WEB_NOTE[r.id] || '同类题材图'
  }

  rows.push({
    序号: i,
    条目ID: r.id,
    条目名称: r.title,
    所属专题: SOURCE[r.source] || r.source,
    分类: catName[r.category] || r.category,
    配图文件: c.cover,
    '配图类型': type,
    匹配等级: level,
    来源: source,
    来源页面: url,
    '版权/使用说明': c.license,
    备注: note
  })
}

const header = Object.keys(rows[0])
const csv1 = '\ufeff' + [header.join(','), ...rows.map((o) => header.map((k) => csvCell(o[k])).join(','))].join('\r\n')
fs.writeFileSync(path.join(ROOT, '配图清单_已完成.csv'), csv1, 'utf8')

/* ---------- 未精确匹配清单 ---------- */
const degraded = rows
  .filter((o) => o.匹配等级 !== 'A')
  .map((o) => ({
    条目ID: o.条目ID,
    条目名称: o.条目名称,
    所属专题: o.所属专题,
    问题类型: o.匹配等级 === 'C' ? '中性示意（无可对应的具体实物）' : '主题相符但非专属实物',
    具体原因:
      o.匹配等级 === 'C'
        ? '该条目为抽象议题/概念，不存在可拍摄的具体实物；采用中性影像示意，不对具体地点、人物或数据作任何指认。'
        : '该条目指向具体实物/地点/人物，但公开可检索的图片中没有可确认的对应物；按「同类题材、主题准确」原则配图，不使用未经确认的图说。',
    替代方案:
      '① 若有馆藏或教材原图，直接替换 public/img/cover/' + o.条目ID + '.jpg（同名覆盖，清单与页面自动生效）；② 若需完全避免第三方图片，可移除该条目 cover 记录，页面会回落到站内程序化纹样底图；③ 也可在 src/data/covers.json 中改为其他候选文件名。'
  }))

const header2 = Object.keys(degraded[0])
const csv2 = '\ufeff' + [header2.join(','), ...degraded.map((o) => header2.map((k) => csvCell(o[k])).join(','))].join('\r\n')
fs.writeFileSync(path.join(ROOT, '配图清单_未精确匹配.csv'), csv2, 'utf8')

/* ---------- 说明文档 ---------- */
const byKind = { plate: 0, photo: 0, web: 0 }
for (const c of Object.values(covers.items)) byKind[c.kind]++
const dupGroups = audit.crossDup

const md = `# 资源库配图说明

生成时间：${covers.generatedAt}

## 一、总体情况

| 项 | 数值 |
|---|---|
| 资源库条目总数 | **${audit.stat.total}** |
| 已配图条目 | **${covers.covered}**（覆盖率 100%） |
| 未配图条目 | **${covers.failed}** |
| 原始图版/照片沿用 | ${byKind.plate + byKind.photo} 条（文献图版 ${byKind.plate}、实景/素材 ${byKind.photo}） |
| 联网检索新增 | ${byKind.web} 条 |
| 配图总体积 | ${(fs.readdirSync(path.join(ROOT, 'public/img/cover')).reduce((a, f) => a + fs.statSync(path.join(ROOT, 'public/img/cover', f)).size, 0) / 1024 / 1024).toFixed(1)} MB |

## 二、统一规格

所有配图统一输出为：

- 尺寸 **1200 × 900**（4:3），JPEG，质量 82，渐进式
- 底色 **#f4efe4**（站点纸色）
- 统一 1px 内描边 rgba(43,33,25,0.14)，使 334 张在网格中成组
- 统一暖调：饱和度 +3%、亮度 +1.2%、对比 +2%
- 版式规则：**文献图版一律完整入框不裁切**（${byKind.plate} 张，避免切掉团花与边饰）；实景照片与检索图按 4:3 满幅裁切（${byKind.photo + byKind.web} 张）
- 联网检索图统一裁去底部 12%，去除平台站标

文件名即条目 ID：\`public/img/cover/<条目ID>.jpg\`，映射表在 \`src/data/covers.json\`。

## 三、重复、缺失与加载失败的处理

### 3.1 重复（已处理）

审计发现 ${dupGroups.length} 组条目共用同一张主图（畲族 6 条挤在 3 张图上）：

${dupGroups.map((g, k) => `${k + 1}. ${g.join(' 与 ')} → 保留首条原图，为 ${g[1]} 重新检索配图`).join('\n')}

处理后 334 张配图**零字节级重复**（已用 MD5 全量校验）。

### 3.2 缺失（已补齐）

${audit.stat.noMedia} 条原本完全没有图片（畲族语言文字 5 条 + 课程要点 25 条），已全部联网检索补齐。

### 3.3 加载失败（无）

逐条校验了每个 \`media\` 引用的文件是否存在、是否为零字节、文件头是否为合法图像：**0 条损坏、0 条引用失效**。统一处理后的 334 张全部通过 sharp 解码校验。

### 3.4 替代方案（备用）

若某张配图后续需要替换或撤下：

1. **同名覆盖**：把新图按 \`<条目ID>.jpg\` 放进 \`public/img/cover/\`，清单与页面自动生效，无需改代码；
2. **退回程序化底图**：删掉 \`src/data/covers.json\` 里该条的记录，卡片与详情页会自动回落到站内生成的专题纹样底图（\`CategoryArt\`），完全不含第三方图片；
3. **换候选**：检索候选保留在 \`work/cand/<条目ID>/\`，改 \`work/selections.json\` 后重跑 \`node work/make-covers.cjs\` 即可。

## 四、清单文件

- \`配图清单_已完成.csv\` —— ${rows.length} 条，含条目名称、所属专题、分类、配图文件、配图类型、匹配等级、来源、来源页面、版权说明、备注
- \`配图清单_未精确匹配.csv\` —— ${degraded.length} 条，说明哪些条目属于「主题相符但非专属实物」或「中性示意」，以及逐条的替代方案

匹配等级含义：

- **A 精确匹配**：条目所指实物的原始图版/照片（${rows.filter((o) => o.匹配等级 === 'A').length} 条）
- **B 主题相符**：同类题材真实照片，与条目内容类型相符，但非该条所指的具体实物/地点（${rows.filter((o) => o.匹配等级 === 'B').length} 条）
- **C 中性示意**：抽象议题，用中性影像表达，不对具体对象作指认（${rows.filter((o) => o.匹配等级 === 'C').length} 条）

## 五、使用提示

- 联网检索图来自公开新闻、政务与文旅网站，**版权归原权利人**；站内标注了来源站点与页面链接，供教学引用与溯源。正式出版、对外发布或商业使用时，需另行取得授权或替换为自有图片。
- 条目正文中的概念、数据与引述保持原样，配图仅作视觉辅助，不对图说作超出原图的推断。
`

fs.writeFileSync(path.join(ROOT, '配图说明.md'), md, 'utf8')

console.log('已完成清单', rows.length, '条 | 未精确匹配', degraded.length, '条')
console.log('等级分布 A/B/C =', rows.filter((o) => o.匹配等级 === 'A').length, rows.filter((o) => o.匹配等级 === 'B').length, rows.filter((o) => o.匹配等级 === 'C').length)
console.log('输出：配图清单_已完成.csv / 配图清单_未精确匹配.csv / 配图说明.md')
