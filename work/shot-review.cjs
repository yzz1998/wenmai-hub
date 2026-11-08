/* 单独高清截 AI 评阅面板，用于核对进度条宽度、圆环弧度与文字排版 */
const { chromium } = require('playwright-core')
const BASE = process.env.BASE || 'http://127.0.0.1:5183'

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({
    viewport: { width: 900, height: 1200 },
    deviceScaleFactor: 2
  })
  await page.goto(`${BASE}/#/works`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  // 全新 profile 的 localStorage 是空的，没有评阅数据就截不到面板。
  // 读出首个成果 id，注入一份四维评分各不相同的评阅记录，用来核对进度条比例。
  const injected = await page.evaluate(() => {
    const works = JSON.parse(localStorage.getItem('wenmai.works.v1') || '[]')
    if (!works.length) return null
    const id = works[0].id
    const dims = [
      ['relevance', '内容切题与完整', 23],
      ['evidence', '论证与证据', 20],
      ['structure', '结构与表达', 15],
      ['norm', '规范与引用', 8]
    ]
    const review = {
      total: 66,
      dimensions: dims.map(([key, name, score]) => ({
        key,
        name,
        score,
        max: 25,
        level: score >= 21 ? '优秀' : score >= 17 ? '良好' : score >= 13 ? '合格' : '待改进',
        comment: `${name}这一维的评语示例，用来说明评语区在长句情况下的换行表现是否正常。`,
        evidence: '原文摘录示例，不超过四十字。'
      })),
      summary: '总评示例：选题贴合课程目标，材料较扎实，但引文规范与结构层次仍有明显提升空间。',
      suggestions: ['补全文末参考文献的出版信息', '在第二部分增加一处反证材料', '统一各级标题的编号格式'],
      model: 'shot-fixture',
      source: 'mock',
      rubric: 'v1',
      createdAt: new Date().toISOString(),
      truncated: false
    }
    localStorage.setItem('wenmai.reviews.v1', JSON.stringify({ [id]: review }))
    return id
  })
  if (!injected) throw new Error('没有成果数据，先跑一次 test-review.cjs 或打开站点初始化')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(600)

  // 列表按学期分组排序，第一张卡不一定是注入的那条，直接按 id 进详情
  await page.goto(`${BASE}/#/works/${injected}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  const panel = page.locator('[data-testid="review-panel"]')
  await panel.screenshot({ path: 'work/shots/review-panel-2x.png' })

  // 顺手量一下每根进度条的实际填充比例，跟分数对一对
  const bars = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="review-dim-score"]')]
    return rows.map((el) => {
      const wrap = el.closest('div').parentElement
      const track = wrap.querySelector('.h-1\\.5')
      const fill = track?.firstElementChild
      return {
        score: el.textContent.replace(/\s+/g, ' ').trim(),
        trackW: track ? Math.round(track.getBoundingClientRect().width) : 0,
        fillW: fill ? Math.round(fill.getBoundingClientRect().width) : 0
      }
    })
  })
  console.log(JSON.stringify(bars, null, 2))

  await browser.close()
})()
