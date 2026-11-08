/**
 * 教案七维量表的「集成核查」脚本。
 *
 * 回答一个问题：这套新维度是真的接进系统了，还是只写了一堆常量放在那儿没人用？
 * 所以分三层查，每层都要能指到具体代码：
 *
 *   1. 量表层 —— 七个维度是否都在、满分是否合计 100、key 与 prompt 是否一致；
 *   2. 清洗层 —— 模型只回 4 条（或顺序打乱）时，能否按七维重建而不是跟着模型走；
 *   3. 界面层 —— 选教案后提交，评阅面板是否真的渲染七行、总分是否等于七行之和。
 *
 * 全程不调真实模型（用示例模式与本地构造的脏数据），所以可以随时跑。
 *
 * 用法：node work/verify-rubric.cjs   （需 vite 在 5183）
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://127.0.0.1:5183'
const FIXTURE = path.join(__dirname, 'fixtures', 'lesson-plan.txt')

const results = []
const ok = (n, d = '') => {
  results.push({ n, pass: true })
  console.log(`  ✓ ${n}${d ? `  ${d}` : ''}`)
}
const bad = (n, d = '') => {
  results.push({ n, pass: false })
  console.log(`  ✗ ${n}${d ? `  ${d}` : ''}`)
}
const rule = (t) => console.log(`\n==== ${t} ====`)

const LESSON_DIMS = [
  ['objectives', '目标适切性', 18],
  ['accuracy', '内容准确性', 15],
  ['focus', '重难点把握', 12],
  ['process', '过程与时间结构', 20],
  ['activity', '任务与活动设计', 15],
  ['assessment', '评价与一致性', 12],
  ['feasibility', '规范性与可执行性', 8]
]

;(async () => {
  /* ---------------- 1. 量表层 ---------------- */
  rule('1. 量表注册表')
  const R = await import('../cloud-functions/_lib/rubric.js')
  const L = R.getRubric('lesson')

  R.RUBRIC_KEYS.includes('lesson')
    ? ok('lesson 量表已注册', R.RUBRIC_KEYS.join(' / '))
    : bad('lesson 量表已注册', R.RUBRIC_KEYS.join(','))

  const same =
    L.dimensions.length === LESSON_DIMS.length &&
    LESSON_DIMS.every(([k, name, max], i) => L.dimensions[i].key === k && L.dimensions[i].name === name && L.dimensions[i].max === max)
  same
    ? ok('七个维度的 key / 名称 / 满分与既定方案一致', LESSON_DIMS.map((d) => `${d[1]}${d[2]}`).join(' '))
    : bad('七维定义与既定方案不一致', L.dimensions.map((d) => `${d.key}:${d.max}`).join(','))

  const sum = L.dimensions.reduce((s, d) => s + d.max, 0)
  sum === 100 && L.total === 100 ? ok('满分合计 = 100', `${sum}`) : bad('满分合计 = 100', `${sum} / 声明 ${L.total}`)

  L.systemPrompt.includes('七个维度') && LESSON_DIMS.every(([k]) => L.systemPrompt.includes(`"key": "${k}"`))
    ? ok('prompt 里逐维写明了 key，与代码定义同源')
    : bad('prompt 与维度定义不同步', '有 key 未出现在 prompt 示例中')

  R.resolveRubricKey({ work: { type: 'lesson_plan' } }) === 'lesson'
    ? ok('成果类型 lesson_plan 自动选教案量表')
    : bad('成果类型 lesson_plan 未选中教案量表', R.resolveRubricKey({ work: { type: 'lesson_plan' } }))
  R.resolveRubricKey({ work: { type: 'article' } }) === 'paper'
    ? ok('文章仍走通用四维量表')
    : bad('文章量表选错', R.resolveRubricKey({ work: { type: 'article' } }))
  R.resolveRubricKey({ work: { type: 'lesson_plan' }, rubric: 'paper' }) === 'paper'
    ? ok('显式指定 key 的优先级高于类型（可换量表复核）')
    : bad('显式指定 key 未生效')

  /* ---------------- 2. 清洗层 ---------------- */
  rule('2. 输出清洗（按量表重建，不跟模型走）')
  const N = await import('../cloud-functions/_lib/normalize.js')

  // 故意给脏数据：顺序打乱、超满分、字符串、缺项、多余维度
  const dirty = {
    total: 99, // 模型自报总分，必须被忽略
    dimensions: [
      { key: 'process', score: 26, comment: '超满分应被钳到 20', evidence: 'x' }, // 超满分
      { key: 'objectives', score: '15', comment: '字符串分数', evidence: 'y' }, // 字符串
      { key: 'focus', score: 11.6, comment: '小数应四舍五入', evidence: 'z' }, // 小数
      { key: 'bogus', score: 30, comment: '不存在的维度应被丢弃', evidence: 'w' } // 多余
      // accuracy / activity / assessment / feasibility 全部缺失
    ],
    summary: '总评',
    suggestions: ['改这里']
  }
  const out = N.normalizeReview(dirty, { rubricKey: 'lesson', inputChars: 3000 })

  out.dimensions.length === 7
    ? ok('模型只回 4 条时按七维重建', `${out.dimensions.length} 行`)
    : bad('未按七维重建', `${out.dimensions.length} 行`)
  out.dimensions.every((d, i) => d.key === LESSON_DIMS[i][0])
    ? ok('重建顺序与量表一致（不按模型给的顺序）')
    : bad('重建顺序错乱', out.dimensions.map((d) => d.key).join(','))

  // 注意：变量名不要叫 process —— 会遮蔽 Node 全局，导致结尾 process.exit 报错
  const processDim = out.dimensions.find((d) => d.key === 'process')
  processDim.score === 20 && processDim.max === 20
    ? ok('超满分被钳到该维满分', `process 26 → ${processDim.score}/${processDim.max}`)
    : bad('超满分钳位失败', `process=${processDim.score}/${processDim.max}`)
  const obj = out.dimensions.find((d) => d.key === 'objectives')
  obj.score === 15 ? ok('字符串分数被解析', `objectives "15" → ${obj.score}`) : bad('字符串分数解析失败', String(obj.score))
  const focus = out.dimensions.find((d) => d.key === 'focus')
  focus.score === 12 ? ok('小数四舍五入并钳位', `focus 11.6 → ${focus.score}/${focus.max}`) : bad('小数处理失败', String(focus.score))

  const missing = out.dimensions.filter((d) => ['accuracy', 'activity', 'assessment', 'feasibility'].includes(d.key))
  missing.every((d) => d.score === 0 && d.level === '待改进')
    ? ok('缺失维度补 0 并标注等级', `补 ${missing.length} 维`)
    : bad('缺失维度未正确补齐')

  out.total === out.dimensions.reduce((s, d) => s + d.score, 0) && out.total !== 99
    ? ok('总分由程序重算，不采信模型自报的 99', `实际 ${out.total}`)
    : bad('总分仍采信模型自报值', String(out.total))
  out.rubricKey === 'lesson' && out.rubricName === '教案评阅量表'
    ? ok('结果带量表标识（可追溯是哪套标准评的）', `${out.rubricKey} / ${out.rubric}`)
    : bad('结果缺少量表标识')

  /* ---------------- 3. 云函数健康探针 ---------------- */
  rule('3. 云函数健康探针')
  const api = await import('../cloud-functions/api/review.js')
  const probe = await (await api.onRequestGet({ env: {} })).json()
  const meta = probe?.data?.rubric
  const lessonMeta = (meta?.rubrics || []).find((r) => r.key === 'lesson')
  lessonMeta && lessonMeta.dimensions.length === 7
    ? ok('探针回报 lesson 七维', lessonMeta.dimensions.map((d) => `${d.key}${d.max}`).join(' '))
    : bad('探针未回报教案量表')
  meta?.rubrics?.length === 2 ? ok('两套量表都在探针里', meta.rubrics.map((r) => `${r.key}:${r.dimensions.length}维`).join(' / ')) : bad('探针量表数量异常')

  /* ---------------- 4. 界面层 ---------------- */
  rule('4. 界面层（示例模式，不调模型）')
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160))
  })

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() =>
    localStorage.setItem(
      'wenmai.settings.v1',
      JSON.stringify({ apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', mock: true, relay: false, vision: false })
    )
  )
  await page.goto(`${BASE}/?v=${Date.now()}#/works/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)

  // 提交前：选教案 → 评分标准预览应切成七维
  await page.getByRole('button', { name: '文章', exact: true }).first().click()
  await page.waitForTimeout(200)
  const paperCards = await page.locator('details .grid > div').count()
  paperCards === 4 ? ok('选「文章」时预览四维', `${paperCards} 条`) : bad('选「文章」时预览四维', `${paperCards} 条`)

  await page.getByRole('button', { name: '教案', exact: true }).first().click()
  await page.waitForTimeout(200)
  const lessonCards = await page.locator('details .grid > div').count()
  lessonCards === 7 ? ok('选「教案」时预览切成七维', `${lessonCards} 条`) : bad('选「教案」时预览七维', `${lessonCards} 条`)

  // 取「评阅按什么标准打分」那一块。
  // 两个坑：① 不能取 first()，页面上还有别的 details；② 面板默认折叠，
  // innerText 对隐藏内容返回空串，必须用 textContent 才拿得到维度名。
  const previewText = await page
    .locator('details', { hasText: '评阅按什么标准打分' })
    .first()
    .evaluate((el) => el.textContent || '')
  LESSON_DIMS.every(([, name]) => previewText.includes(name))
    ? ok('预览里的七维名称与量表一致')
    : bad('预览缺维度', LESSON_DIMS.filter(([, n]) => !previewText.includes(n)).map((d) => d[1]).join('、'))

  // 提交一份教案 → 示例模式评阅 → 面板应出七行
  const text = fs.readFileSync(FIXTURE, 'utf8').slice(0, 1200)
  await page.locator('#wf-title').fill('核查用教案（七维）')
  await page.locator('#wf-author').fill('核查')
  await page.locator('#wf-summary').fill('用于核查教案七维量表是否真的接入界面与数据链路。')
  await page.locator('#wf-content').fill(text)
  await page.locator('[data-testid="submit-work"]').click()

  const got = await page
    .waitForFunction(() => document.querySelector('[data-testid="review-total"]'), { timeout: 30000 })
    .then(() => true)
    .catch(() => false)

  if (!got) {
    bad('示例模式评阅出分', '没等到总分')
  } else {
    const rows = await page.locator('[data-testid="review-dim-score"]').count()
    rows === 7 ? ok('评阅面板渲染七行', `${rows} 行`) : bad('评阅面板行数不对', `${rows} 行`)

    const scores = (await page.locator('[data-testid="review-dim-score"]').allInnerTexts()).map((s) => Number(String(s).split('/')[0].trim()))
    const maxims = (await page.locator('[data-testid="review-dim-score"]').allInnerTexts()).map((s) => Number(String(s).split('/')[1].trim()))
    const total = Number((await page.locator('[data-testid="review-total"]').first().innerText()).trim())
    total === scores.reduce((a, b) => a + b, 0)
      ? ok('总分 = 七行之和', `${total} = ${scores.join('+')}`)
      : bad('总分与分项不符', `${total} ≠ ${scores.join('+')}`)
    maxims.join(',') === LESSON_DIMS.map((d) => d[2]).join(',')
      ? ok('每行显示的分母与量表满分一致', maxims.join(' / '))
      : bad('分母不是量表满分', maxims.join(','))

    const panel = await page.locator('[data-testid="review-panel"]').innerText()
    panel.includes('7 维') ? ok('面板表头标注「7 维 · 教案评阅量表」') : bad('面板表头未标注七维')
    panel.includes('教案评阅量表') ? ok('面板显示所用量表名称') : bad('面板未显示量表名称')
  }

  /* ---------------- 5. 换量表之后 ---------------- */
  rule('5. 评阅后改成果类型（界面不能自相矛盾）')
  const wid = (page.url().split('/works/')[1] || '').split('?')[0]
  if (!wid) {
    bad('拿到成果编号', page.url())
  } else {
    await page.goto(`${BASE}/#/works/new/${wid}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: '文章', exact: true }).first().click()
    await page.locator('[data-testid="submit-work"]').click()
    await page.waitForTimeout(900)

    const badge = await page.locator('[data-testid="review-rubric-badge"]').innerText()
    badge.includes('7 维')
      ? ok('表头仍按「已有结果」的量表标注', badge.replace(/\s+/g, ' '))
      : bad('表头被改成了新类型，与显示的 7 行不符', badge.replace(/\s+/g, ' '))

    const notice = await page.locator('[data-testid="review-rubric-switched"]').count()
    notice === 1
      ? ok('明确提示「结果按旧量表评、重评会换标准、分数不可比」')
      : bad('换量表后没有任何提示', `${notice} 条提示`)

    const rowsAfter = await page.locator('[data-testid="review-dim-score"]').count()
    rowsAfter === 7 ? ok('旧结果仍完整展示七行（不被新类型截断）', `${rowsAfter} 行`) : bad('旧结果行数异常', `${rowsAfter} 行`)
  }

  await page.screenshot({ path: path.join(__dirname, 'shots', 'verify-rubric-lesson.png') })
  await browser.close()

  console.log('')
  errors.length ? console.log(`浏览器错误：${[...new Set(errors)].join(' | ')}`) : console.log('浏览器错误：无')
  const pass = results.filter((r) => r.pass).length
  console.log(`\n核查通过 ${pass} / ${results.length}`)
  process.exit(pass === results.length ? 0 : 1)
})().catch((e) => {
  console.error('核查脚本异常：', e)
  process.exit(1)
})
