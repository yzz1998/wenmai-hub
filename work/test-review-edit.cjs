/**
 * 人工修订评阅结果 —— 端到端核查（不花任何模型调用）。
 *
 * 做法：把 work/live-lesson-result.json（真实 deepseek-flash 七维结果）注入 localStorage，
 * 再在真实浏览器里走一遍「进入编辑 → 改分 → 保存 → 刷新 → 导出 → 恢复」。
 *
 * 覆盖的关键契约：
 * - 分数超满分必须被钳到该维满分，等级跟着分数走
 * - 总分只能由分项求和，不能手填
 * - 保存后详情页、成果列表、导出报告读到的是同一份数据
 * - 刷新/重开页面后修订仍在（localStorage 落盘）
 * - AI 原始结果可一键恢复，且恢复后不再显示「已修订」
 *
 * 用法：node work/test-review-edit.cjs
 * 前置：npm run dev（默认 127.0.0.1:5183），可用 BASE 覆盖
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://127.0.0.1:5183'
const WORK_ID = 'W-EDIT-CASE'
const RESULT = path.join(__dirname, 'live-lesson-result.json')

if (!fs.existsSync(RESULT)) {
  console.error('缺少 work/live-lesson-result.json，先跑 work/test-live-lesson.mjs')
  process.exit(2)
}
const { review: AI_REVIEW } = JSON.parse(fs.readFileSync(RESULT, 'utf8'))

const WORK = {
  id: WORK_ID,
  title: '唐宋经典诗词解析（人工修订测试）',
  type: 'lesson_plan',
  author: '宁德开大附小 语文组',
  grade: '5-6 年级',
  semester: '2026秋',
  course: '语文',
  summary: '以《元日》《九月九日忆山东兄弟》为例，教学生用三步读节令诗，并把细节改写成 80 字片段。',
  content: '一、教学目标\n1. 能借助注释说出两首诗的节令与习俗。\n2. 能找出关键细节并说明其表达作用。',
  tags: ['唐宋诗词', '节令诗'],
  docs: [],
  createdAt: '2026-11-07T14:20:00.000Z',
  updatedAt: '2026-11-07T14:20:00.000Z'
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${ok || !detail ? '' : ` — ${detail}`}`)
}

const num = async (loc) => {
  const t = await loc.innerText()
  return Number(String(t).replace(/[^\d.-]/g, ''))
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } })
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message))

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(
    ({ id, work, review }) => {
      const works = JSON.parse(localStorage.getItem('wenmai.works.v1') || '[]')
      localStorage.setItem('wenmai.works.v1', JSON.stringify([work, ...works.filter((w) => w.id !== id)]))
      const reviews = JSON.parse(localStorage.getItem('wenmai.reviews.v1') || '{}')
      reviews[id] = { ...review, workId: id, edited: false, origin: null, editedAt: null, editCount: 0 }
      localStorage.setItem('wenmai.reviews.v1', JSON.stringify(reviews))
    },
    { id: WORK_ID, work: WORK, review: AI_REVIEW }
  )

  // 必须带 query 整页重载：只改 hash 不会重新挂载，store 已把种子数据写回去了
  const open = async (tag) => {
    await page.goto(`${BASE}/?${tag}=${Date.now()}#/works/${WORK_ID}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-testid="review-panel"]')
    await page.waitForTimeout(350)
  }
  await open('inject')

  const originalTotal = AI_REVIEW.total
  const firstDim = AI_REVIEW.dimensions[0]
  check('初始为只读 AI 结果', !(await page.isVisible('[data-testid="review-editor"]')))
  check('初始总分与模型输出一致', (await num(page.locator('[data-testid="review-total"]'))) === originalTotal)

  /* ---------- 1. 进入编辑 ---------- */
  await page.click('[data-testid="review-edit-enter"]')
  await page.waitForSelector('[data-testid="review-editor"]')
  const scoreInputs = page.locator('[data-testid="review-edit-score"]')
  const nDims = await scoreInputs.count()
  check('编辑入口可用且维度数与量表一致', nDims === AI_REVIEW.dimensions.length, `输入框 ${nDims} 个`)
  check('评语/证据/总评均可编辑',
    (await page.locator('[data-testid="review-edit-comment"]').count()) === nDims &&
      (await page.locator('[data-testid="review-edit-evidence"]').count()) === nDims &&
      (await page.locator('[data-testid="review-edit-summary"]').count()) === 1)

  /* ---------- 2. 分数约束 ---------- */
  await scoreInputs.nth(0).fill('99')
  await scoreInputs.nth(0).blur()
  const clamped = Number(await scoreInputs.nth(0).inputValue())
  check('超满分被钳到该维满分', clamped === firstDim.max, `期望 ${firstDim.max}，实际 ${clamped}`)

  await scoreInputs.nth(0).fill('-5')
  await scoreInputs.nth(0).blur()
  check('负分被钳到 0', Number(await scoreInputs.nth(0).inputValue()) === 0)

  await scoreInputs.nth(0).fill(String(firstDim.max))
  await scoreInputs.nth(0).blur()

  const expectTotal = originalTotal - firstDim.score + firstDim.max
  const liveTotal = await num(page.locator('[data-testid="review-total"]'))
  check('编辑时总分实时按分项求和', liveTotal === expectTotal, `期望 ${expectTotal}，实际 ${liveTotal}`)

  /* ---------- 3. 文本编辑 ---------- */
  await page.locator('[data-testid="review-edit-comment"]').nth(0).fill('【人工】目标与课标条目对应，但缺少可观察的行为动词，建议把「体会」改为「说出」。')
  await page.locator('[data-testid="review-edit-evidence"]').nth(0).fill('【人工】"能借助注释说出两首诗的节令与习俗"')
  await page.locator('[data-testid="review-edit-summary"]').fill('【人工修订】教学结构与活动设计完整，评价方式偏笼统；建议为每条目标补充可判定的评价证据后即可用于课堂。')

  const sugBefore = await page.locator('[data-testid="review-edit-suggestion"]').count()
  await page.click('[data-testid="review-edit-suggestion-add"]')
  await page.locator('[data-testid="review-edit-suggestion"]').nth(sugBefore).fill('【人工】为「说出节令习俗」设计一张两栏对照表的课堂小测')
  check('可新增改进建议条目', (await page.locator('[data-testid="review-edit-suggestion"]').count()) === sugBefore + 1)

  /* ---------- 4. 放弃修改要确认 ---------- */
  await page.click('[data-testid="review-edit-cancel"]')
  const discardDialog = page.getByText('放弃未保存的修改？')
  check('有未保存修改时取消会二次确认', await discardDialog.isVisible())
  await page.getByRole('button', { name: '放弃修改' }).click()
  await page.waitForTimeout(200)
  check('确认放弃后退出编辑', !(await page.isVisible('[data-testid="review-editor"]')))

  // 重新进入，这次真正保存
  await page.click('[data-testid="review-edit-enter"]')
  await page.locator('[data-testid="review-edit-score"]').nth(0).fill(String(firstDim.max))
  await page.locator('[data-testid="review-edit-score"]').nth(0).blur()
  await page.locator('[data-testid="review-edit-comment"]').nth(0).fill('【人工】目标与课标条目对应，但缺少可观察的行为动词，建议把「体会」改为「说出」。')
  await page.locator('[data-testid="review-edit-summary"]').fill('【人工修订】教学结构与活动设计完整，评价方式偏笼统；建议为每条目标补充可判定的评价证据后即可用于课堂。')
  const sugAdd = await page.locator('[data-testid="review-edit-suggestion"]').count()
  await page.click('[data-testid="review-edit-suggestion-add"]')
  await page.locator('[data-testid="review-edit-suggestion"]').nth(sugAdd).fill('【人工】为「说出节令习俗」设计一张两栏对照表的课堂小测')
  await page.click('[data-testid="review-edit-save"]')
  await page.waitForTimeout(400)

  /* ---------- 5. 保存后的只读视图 ---------- */
  check('保存后退出编辑态', !(await page.isVisible('[data-testid="review-editor"]')))
  check('标题栏出现「已人工修订」', await page.isVisible('[data-testid="review-edited-badge"]'))
  check('总分等于修订后分项之和', (await num(page.locator('[data-testid="review-total"]'))) === liveTotal, `期望 ${liveTotal}`)
  const panelText = await page.locator('[data-testid="review-panel"]').innerText()
  check('修订后的评语已显示', panelText.includes('【人工】目标与课标条目对应'))
  check('修订后的总评已显示', panelText.includes('【人工修订】教学结构与活动设计完整'))
  check('被改维度带 ✎ 标记', (await page.locator('[data-testid="review-dim-edited"]').count()) >= 1)
  check('详情页副标题标明已修订', (await page.locator('header').first().innerText()).includes('已修订') || panelText.includes('已修订'))
  check('侧栏成果信息标注人工修订', (await page.locator('aside').innerText()).includes('人工修订'))

  /* ---------- 6. 落盘 ---------- */
  const saved = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem('wenmai.reviews.v1') || '{}')[id],
    WORK_ID
  )
  check('结果已写入 localStorage', Boolean(saved) && saved.edited === true)
  check('落盘总分与界面一致', saved?.total === liveTotal, `落盘 ${saved?.total}`)
  check('保留 AI 原始结果快照', saved?.origin?.total === originalTotal, `origin.total=${saved?.origin?.total}`)
  check('修订次数已记录', saved?.editCount === 1, `editCount=${saved?.editCount}`)
  check('等级由分数重算（无矛盾组合）', saved?.dimensions?.every((d) => {
    const r = d.score / d.max
    const lv = r >= 0.88 ? '优秀' : r >= 0.72 ? '良好' : r >= 0.6 ? '合格' : '待改进'
    return d.level === lv
  }))

  /* ---------- 7. 刷新后仍可查看 ---------- */
  await open('reload')
  check('刷新后修订仍在（徽标）', await page.isVisible('[data-testid="review-edited-badge"]'))
  check('刷新后总分不变', (await num(page.locator('[data-testid="review-total"]'))) === liveTotal)
  check('刷新后仍有 ✎ 标记', (await page.locator('[data-testid="review-dim-edited"]').count()) >= 1)

  /* ---------- 8. 导出报告 ---------- */
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.getByRole('button', { name: '导出报告' }).click()
  ])
  const file = await download.path()
  const md = fs.readFileSync(file, 'utf8')
  check('导出文件名标注人工修订', download.suggestedFilename().includes('人工修订'), download.suggestedFilename())
  check('报告声明人工修订', md.includes('人工修订：是'))
  check('报告给改过的维度打 ✎', md.includes('✎'))
  check('报告总分与修订后一致', md.includes(`${liveTotal} / 100`), String(liveTotal))
  check('报告含修订后的评语与建议', md.includes('【人工】') && md.includes('两栏对照表'))

  /* ---------- 9. 成果列表同步 ---------- */
  await page.goto(`${BASE}/?list=${Date.now()}#/works`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const scores = await page.locator('[data-testid="work-score"]').allInnerTexts()
  check('成果列表显示修订后的分数', scores.some((s) => Number(String(s).replace(/[^\d]/g, '')) === liveTotal), scores.join(','))

  /* ---------- 10. 恢复 AI 原始结果 ---------- */
  await open('restore')
  await page.click('[data-testid="review-restore-inline"]')
  await page.getByText('恢复 AI 原始结果？').waitFor()
  await page.getByRole('button', { name: '恢复原结果' }).click()
  await page.waitForTimeout(400)
  check('恢复后总分回到 AI 原判', (await num(page.locator('[data-testid="review-total"]'))) === originalTotal, `期望 ${originalTotal}`)
  check('恢复后不再显示已修订徽标', !(await page.isVisible('[data-testid="review-edited-badge"]')))
  check('恢复后 ✎ 标记消失', (await page.locator('[data-testid="review-dim-edited"]').count()) === 0)
  const after = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem('wenmai.reviews.v1') || '{}')[id],
    WORK_ID
  )
  check('恢复已落盘', after?.edited === false && after?.origin === null && after?.total === originalTotal)

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} 通过`)
  if (failed.length) {
    console.log('失败项：')
    failed.forEach((f) => console.log(` - ${f.name}${f.detail ? `（${f.detail}）` : ''}`))
    process.exitCode = 1
  }
})().catch((e) => {
  console.error('脚本异常：', e)
  process.exitCode = 1
})
