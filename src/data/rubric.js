/**
 * 评阅量表的「展示视图」。
 *
 * 现在系统里有两套量表，学生提交前应该看到的是**自己那份会用的标准**：
 * 交文章看四维，交教案看七维。所以这里不再是手写一份副本，
 * 而是从真源 `cloud-functions/_lib/rubrics/*` 派生——维度名、满分、观测点全部同源，
 * 改量表只改一处，界面文案与 prompt 不会各说各话。
 */

import { RUBRICS, RUBRIC_KEYS, getRubric, resolveRubricKey } from '../lib/review-core'

/** 展示用视图：把 prompt 里的四档锚点收起来，只留学生看得懂的观测点 */
export const RUBRIC_VIEWS = RUBRIC_KEYS.map((k) => {
  const r = RUBRICS[k]
  return {
    key: r.key,
    name: r.name,
    shortName: r.shortName,
    total: r.total,
    dimsHint: r.dimsHint,
    bodyLabel: r.bodyLabel,
    appliesTo: r.appliesTo,
    dimensions: r.dimensions.map((d) => ({
      key: d.key,
      name: d.name,
      max: d.max,
      block: d.block,
      desc: `${d.points.join('；')}。`
    }))
  }
})

/** 某成果类型会用哪套量表的展示视图 */
export function rubricViewForType(type) {
  const r = getRubric(resolveRubricKey({ work: { type } }))
  return RUBRIC_VIEWS.find((v) => v.key === r.key) || RUBRIC_VIEWS[0]
}

/** 评分口径的一句话说明，直接展示给学生 */
export function rubricNote(view) {
  const v = view || RUBRIC_VIEWS[0]
  return `${v.dimsHint}，合计 ${v.total} 分；总分由各维求和而非模型单独估。档位：优秀 ≥85 / 良好 70–84 / 合格 60–69 / 待改进 <60。`
}

/**
 * 材料怎么参与评阅 —— 学生提交前最该知道的一条。
 * 不写清楚，会有两种误解：以为传了图就等于得分（不会），或者以为没传图会被扣分（也不会）。
 */
export const RUBRIC_MATERIALS =
  '评阅读取的是本页已保存的内容：文档解析出的正文、网页正文、以及配图清单（张数、图注与正文指代）。' +
  '音视频与外链附件模型无法读取，会标记为「未纳入」，既不据此扣分，也不当作已完成。'
