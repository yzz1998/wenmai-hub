/* 截「成果管理」标签页，核对分数徽标、附件信息与评阅覆盖率摘要的排版 */
const { chromium } = require('playwright-core')
const BASE = process.env.BASE || 'http://127.0.0.1:5183'

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
    deviceScaleFactor: 2
  })
  await page.goto(`${BASE}/#/manage?tab=works`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)

  // 给前两条成果各注入一份评阅，一条有附件、一条没有，覆盖两种排版
  const info = await page.evaluate(() => {
    const works = JSON.parse(localStorage.getItem('wenmai.works.v1') || '[]')
    if (!works.length) return null
    const mk = (total, scores) => ({
      total,
      dimensions: [
        ['relevance', '内容切题与完整'],
        ['evidence', '论证与证据'],
        ['structure', '结构与表达'],
        ['norm', '规范与引用']
      ].map(([key, name], i) => ({
        key,
        name,
        score: scores[i],
        max: 25,
        level: scores[i] >= 21 ? '优秀' : scores[i] >= 17 ? '良好' : scores[i] >= 13 ? '合格' : '待改进',
        comment: '',
        evidence: ''
      })),
      summary: '总评示例',
      suggestions: ['示例建议一', '示例建议二', '示例建议三'],
      model: 'shot-fixture',
      source: 'mock',
      rubric: 'v1',
      createdAt: new Date().toISOString(),
      truncated: false
    })
    const patch = {}
    patch[works[0].id] = mk(88, [23, 22, 21, 22])
    if (works[1]) patch[works[1].id] = mk(61, [18, 14, 16, 13])
    const cur = JSON.parse(localStorage.getItem('wenmai.reviews.v1') || '{}')
    localStorage.setItem('wenmai.reviews.v1', JSON.stringify({ ...cur, ...patch }))
    return { ids: works.slice(0, 2).map((w) => w.id), docs: works.slice(0, 2).map((w) => (w.docs || []).length) }
  })
  if (!info) throw new Error('没有成果数据')
  console.log('注入:', JSON.stringify(info))

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)

  await page.screenshot({ path: 'work/shots/manage-works.png', fullPage: false })

  const n = await page.locator('[data-testid="manage-review-score"]').count()
  const m = await page.locator('[data-testid="manage-review-none"]').count()
  console.log(`分数徽标 ${n} 个，未评阅徽标 ${m} 个`)
  await browser.close()
})()
