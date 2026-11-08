/**
 * 通用成果评阅量表（paper · 四维各 25 分）。
 *
 * 适用于文章、调查札记、作品说明、图片/音视频的文字说明。
 * 维度定义的措辞是从原「四维量表」原样搬过来的——那份 prompt 已经在真实材料上调过，
 * 不要顺手改写它的观测点，否则所有历史评阅结果都会失去可比性。
 */

import { materialsBrief, metaBlock, wrapBody } from '../prompt-kit.js'

export const KEY = 'paper'
export const VERSION = 'v1'
export const PROMPT_VERSION = 'r1'

export const DIMENSIONS = [
  {
    key: 'relevance',
    name: '内容切题与完整',
    max: 25,
    block: '选题与内容',
    points: [
      '是否回应了题目与课程目标',
      '研究对象、方法、过程、结论是否齐备',
      '事实与概念是否准确',
      '篇幅与深度是否匹配',
      '有无整段跑题'
    ],
    anchors: {
      优秀: '该维要求基本全部满足，仅一处可忽略的瑕疵；可作为同侪范本。',
      良好: '主体达标，有一到两处明确缺口，但不影响整体成立。',
      合格: '能看出意图，覆盖不全或质量不稳，需要读者自行补全。',
      待改进: '大面积缺失，或只有空泛表态，看不出做了什么。'
    }
  },
  {
    key: 'evidence',
    name: '论证与证据',
    max: 25,
    block: '论证过程',
    points: [
      '是否有明确论点',
      '访谈、实地记录、数据、文献、图像是否与论点一一对应',
      '推断链是否可追踪',
      '是否交代局限或反例',
      '有无以个人感受替代证据'
    ],
    anchors: {
      优秀: '每个判断都有对应证据，证据可核查，并主动交代局限。',
      良好: '主要判断有证据支撑，个别处靠推断，未说明局限。',
      合格: '有材料但堆砌多于论证，材料与结论之间靠读者补链。',
      待改进: '通篇主观判断，无任何可核查的材料。'
    }
  },
  {
    key: 'structure',
    name: '结构与表达',
    max: 25,
    block: '行文组织',
    points: [
      '引入—展开—收束是否成立',
      '段落是否一意一段，小标题层级是否成立',
      '术语是否前后一致',
      '长句、指代、重复是否影响可读性',
      '标题与内容是否对应'
    ],
    anchors: {
      优秀: '结构清晰，段落职责分明，术语统一，标题与内容严格对应。',
      良好: '结构成立，个别段落职责混杂或标题略偏。',
      合格: '能读下去，但层次不清，需要读者自己整理脉络。',
      待改进: '无分段或段落错乱，读完不知全文讲了什么。'
    }
  },
  {
    key: 'norm',
    name: '规范与引用',
    max: 25,
    block: '来源与格式',
    points: [
      '数据、引语、事实是否标注来源（作者/年份/页码，访谈对象的姓名与时间）',
      '参考文献格式是否统一',
      '图表与图像是否注明出处与授权',
      '错别字、标点、编号、单位格式'
    ],
    anchors: {
      优秀: '关键论断均可溯源，引用格式统一，图表有出处，文字校对干净。',
      良好: '主要来源已标注，格式偶有不统一，个别错别字。',
      合格: '只在文末笼统列出来源，正文无对应标注，格式可辨认但混乱。',
      待改进: '无任何来源标注，或存在整段挪用且未说明。'
    }
  }
]

function levelLines() {
  return DIMENSIONS.map((d) => {
    const pct = (r) => Math.round(d.max * r)
    return (
      `${d.key} ${d.name}（${d.max} 分）—— 观测点：${d.points.join('；')}。\n` +
      `  优秀 ${pct(0.88)}-${d.max}：${d.anchors.优秀}\n  良好 ${pct(0.72)}-${pct(0.88) - 1}：${d.anchors.良好}\n` +
      `  合格 ${pct(0.6)}-${pct(0.72) - 1}：${d.anchors.合格}\n  待改进 0-${pct(0.6) - 1}：${d.anchors.待改进}`
    )
  }).join('\n\n')
}

export const SYSTEM_PROMPT = `你是「文脉馆」学生成果评阅助手，负责按统一量表评阅闽东本土文化主题的学生成果（文章、调查札记、作品说明等）。你的输出会被程序直接解析，必须严格遵守格式。

【量表】总分 100 分，四个维度各 25 分，顺序固定：

${levelLines()}

【评分纪律】以下每一条都会被程序检查，违反即视为无效输出：
1. 每个维度给出 0 到 25 之间的整数。不要自行给出总分，程序会把四项相加。
2. 每个维度必须给出 evidence：从学生原文中原样截取的连续片段，不超过 40 字。确实找不到对应文本时写「（无对应文本）」。不得改写、概括或杜撰原文。
3. 材料不足以判断时，给中性分（12 分左右），并在 comment 中写明「材料不足」。不得臆测作者身份、学校、年级或以往成绩。
4. 只评内容本身：不因排版、字体、图片清晰度扣分。但「作品材料」里列出的配图若无图注、无出处、正文也不指代，属于规范维度可考察的问题，应当扣分并在 comment 中说明。
5. comment 不超过 60 字，必须说清「好在哪 / 差在哪」，禁止「语言优美」「继续努力」「有待提高」这类空泛评价。
6. 不因观点与你不一致而扣分。只看是否切题、是否有据、是否清晰、是否规范。
7. suggestions 给 3 到 5 条，每条不超过 40 字，以动词开头，必须可执行。反例：「多读书」「加强练习」。正例：「补三位受访者的姓名与访谈日期」。
8. 若成果类型为图片、音频或视频，正文是作品说明，此时「结构与表达」只评说明文字自身，不要求它像论文一样分章。
9. 只输出一个 json 对象，不要 markdown 代码块，不要任何解释性文字，不要前后缀。
10. 「未纳入评阅依据」的部分（音频、视频、外部链接）你无法感知，不得评价其内容质量，也不得因为看不到就认定作者没交；若确有需要，只能写进 suggestions，例如「为音频补一份逐字稿，便于他人查阅」。

【输出 json 结构】
{
  "dimensions": [
    {"key": "relevance", "score": 21, "comment": "……", "evidence": "……"},
    {"key": "evidence", "score": 20, "comment": "……", "evidence": "……"},
    {"key": "structure", "score": 22, "comment": "……", "evidence": "……"},
    {"key": "norm", "score": 17, "comment": "……", "evidence": "……"}
  ],
  "summary": "120 到 200 字的总评：先给整体判断，再给一句最有价值的改进方向。",
  "suggestions": ["……", "……", "……"]
}`

/**
 * 拼 user 消息。元数据放在正文之前：模型需要先知道「这是什么类型的作业」，
 * 才知道该用论文的标准还是作品说明的标准来评「结构与表达」。
 */
export function buildUserPrompt({ work = {}, text = '', truncated = false, materials = null }) {
  const chars = String(text).replace(/\s/g, '').length
  const meta = metaBlock(work, { chars, truncated })
  const brief = materialsBrief(materials)

  return `【成果元数据】
${meta}
${brief ? `\n【作品材料】\n${brief}\n` : ''}
${wrapBody(text)}

请严格按 system 中的量表、评分纪律与 json 结构给出评阅结果。`
}

export const RUBRIC = {
  key: KEY,
  version: VERSION,
  promptVersion: PROMPT_VERSION,
  name: '通用成果评阅量表',
  shortName: '通用量表',
  total: 100,
  appliesTo: ['article', 'image', 'audio', 'video'],
  bodyLabel: '正文',
  dimsHint: '四维各 25 分',
  dimensions: DIMENSIONS,
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt
}
