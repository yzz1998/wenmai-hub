/**
 * 一体化联调：浏览器 → HTTP → 云函数 → normalize → 详情页展示。
 *
 * 与 test-review.cjs 的区别：那边走**前端** Mock（不发请求），只验界面链路；
 * 这里不设前端 mock 开关，请求真的打到 /api/review，靠服务端 REVIEW_MOCK=1 返回确定性结果，
 * 所以能同时验证「函数能起、路由通、CORS/JSON 解析对、前端能消费服务端结构」。
 *
 * 前置：edgeone makers dev（8088）已启动，且 .env 里 REVIEW_MOCK=1
 * 用法：node work/test-integrated.cjs
 */
const { chromium } = require('playwright-core')
const path = require('path')

const BASE = process.env.BASE || 'http://127.0.0.1:8088'
const FIX = path.join(__dirname, 'fixtures')

const results = []
const errors = []
const ok = (n, d) => {
  results.push({ n, pass: true })
  console.log(`  ✓ ${n}  ${d ?? ''}`)
}
const bad = (n, d) => {
  results.push({ n, pass: false })
  console.log(`  ✗ ${n}  ${d ?? ''}`)
}

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160))
  })

  // 关键：清掉前端 mock 开关，让请求真的出去
  await page.addInitScript(() => localStorage.removeItem('wenmai.review.mock'))

  const apiCalls = []
  page.on('response', async (r) => {
    if (!r.url().includes('/api/review')) return
    let body = null
    try {
      body = await r.json()
    } catch {
      /* 非 JSON 响应由断言兜住 */
    }
    apiCalls.push({ status: r.status(), ok: body?.ok, code: body?.error?.code })
  })

  await page.goto(`${BASE}/#/works/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  await page.fill('#wf-title', '联调 · 闽东平讲戏田野调查')
  await page.fill('#wf-author', '联调机器人')
  await page.fill('#wf-summary', '验证浏览器到云函数的完整评阅链路。')
  await page.setInputFiles('[data-testid="doc-input"]', path.join(FIX, 'sample.txt'))
  await page.waitForSelector('[data-testid="doc-status"][data-state="ready"]', { timeout: 30000 })

  await page.click('[data-testid="submit-work"]')
  await page.waitForSelector('[data-testid="review-panel"] [data-testid="review-total"]', { timeout: 90000 })
  await page.waitForTimeout(400)

  const dims = await page.locator('[data-testid="review-dim-score"]').allInnerTexts()
  const total = Number((await page.locator('[data-testid="review-total"]').innerText()).replace(/\D/g, ''))
  const scores = dims.map((s) => Number((String(s).match(/\d+/) || [0])[0]))
  const sum = scores.reduce((a, s) => a + s, 0)

  if (apiCalls.length === 1) ok('请求发到了 /api/review', `1 次，HTTP ${apiCalls[0].status}`)
  else bad('请求发到了 /api/review', `${apiCalls.length} 次`)
  if (apiCalls[0]?.status === 200) ok('函数返回 200')
  else bad('函数返回 200', JSON.stringify(apiCalls[0]))
  if (dims.length === 4) ok('页面渲染四维', String(dims.length))
  else bad('页面渲染四维', String(dims.length))
  if (total === sum && total > 0) ok('总分 = 四维之和', `${sum} = ${scores.join('+')}`)
  else bad('总分 = 四维之和', `total=${total} sum=${sum}`)

  // 服务端 mock 的模型标识要如实显示为「示例模式」，不能冒充真实模型
  const head = await page.locator('[data-testid="review-panel"] header').innerText()
  if (/示例模式/.test(head)) ok('来源标注为示例模式', head.replace(/\s+/g, ' ').slice(0, 46))
  else bad('来源标注为示例模式', head.replace(/\s+/g, ' ').slice(0, 60))

  const sugg = await page.locator('[data-testid="review-suggestion"]').count()
  if (sugg >= 3 && sugg <= 5) ok('改进建议 3–5 条', `${sugg} 条`)
  else bad('改进建议 3–5 条', `${sugg} 条`)

  await page.screenshot({ path: 'work/shots/integrated-review.png', fullPage: false })

  const real = errors.filter((e) => !/favicon|React DevTools/.test(e))
  console.log('\n浏览器错误：', real.length ? real.slice(0, 4) : '无')
  const failed = results.filter((r) => !r.pass)
  console.log(`\n通过 ${results.length - failed.length} / ${results.length}`)
  await browser.close()
  process.exit(failed.length || real.length ? 1 : 0)
})()
