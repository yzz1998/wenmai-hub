/**
 * 端到端走查：上传文档 → 入库 → 自动评阅 → 详情页展示。
 *
 * 用 Mock 模式跑：不需要 API Key、不打网络，分数按文本长度确定性生成，
 * 所以既能验证界面链路，也能断言「总分 === 四维之和」这类一致性。
 *
 * 用法：node work/test-review.cjs            （需 vite 在 5183）
 *       BASE=http://127.0.0.1:8088 node work/test-review.cjs   （跑 makers dev，真函数 + mock 环境变量）
 */
const path = require('path')
const { chromium } = require('playwright-core')

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://127.0.0.1:5183'
const FIX = path.join(__dirname, 'fixtures')

const results = []
const ok = (n, d = '') => {
  results.push({ n, d, pass: true })
  console.log(`  ✓ ${n}${d ? `  ${d}` : ''}`)
}
const bad = (n, d = '') => {
  results.push({ n, d, pass: false })
  console.log(`  ✗ ${n}${d ? `  ${d}` : ''}`)
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160))
  })

  // 打开 Mock：走本地确定性结果，不需要函数与 Key
  await page.addInitScript(() => localStorage.setItem('wenmai.review.mock', '1'))

  await page.goto(`${BASE}/#/works/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  // ---------- 表单 ----------
  await page.fill('#wf-title', '冒烟测试 · 闽东传统技艺调查')
  await page.fill('#wf-author', '测试员')
  await page.fill('#wf-summary', '这是一条自动化走查生成的成果，用于验证文档解析与 AI 评阅链路。')

  // 先喂一个旧版 doc，验证明确拒绝
  await page.setInputFiles('[data-testid="doc-input"]', path.join(FIX, 'legacy.doc'))
  await page.waitForSelector('[data-testid="doc-error"]', { timeout: 10000 })
  const legacyMsg = await page.locator('[data-testid="doc-error"]').innerText()
  if (/另存为/.test(legacyMsg) && /docx/i.test(legacyMsg)) ok('旧版 .doc 被明确拒绝', '文案含「另存为 .docx」')
  else bad('旧版 .doc 被明确拒绝', legacyMsg.replace(/\n/g, ' ').slice(0, 60))

  // 换成真 docx
  await page.setInputFiles('[data-testid="doc-input"]', path.join(FIX, 'sample.docx'))
  await page.waitForSelector('[data-testid="doc-status"][data-state="ready"]', { timeout: 30000 })
  const meta = await page.locator('[data-testid="doc-meta"]').innerText()
  if (/\d+ 字/.test(meta)) ok('DOCX 解析就绪', meta.replace(/\n/g, ' '))
  else bad('DOCX 解析就绪', meta)

  // ---------- 入库 + 自动评阅 ----------
  await page.click('[data-testid="submit-work"]')
  await page.waitForSelector('[data-testid="review-panel"] [data-testid="review-total"], [data-testid="review-panel"] [data-testid="review-dim-score"]', {
    timeout: 40000
  })
  await page.waitForTimeout(500)

  const totalText = await page.locator('[data-testid="review-total"]').count()
  const dims = await page.locator('[data-testid="review-dim-score"]').allInnerTexts()
  ok('评阅结果已展示', `${dims.length} 维`)

  const total = Number((await page.locator('[data-testid="review-total"]').innerText()).replace(/\D/g, ''))
  // 每个维度显示成「21 / 25」，取第一个数字才是得分
  const dimScores = dims.map((s) => Number((String(s).match(/\d+/) || [0])[0]))
  const sum = dimScores.reduce((a, s) => a + s, 0)
  if (dims.length === 4) ok('四维齐备', String(dims.length))
  else bad('四维齐备', String(dims.length))
  if (total > 0 && total === sum) ok('总分 = 四维之和', `${sum} = ${dimScores.join('+')}`)
  else bad('总分 = 四维之和', `total=${total} sum=${sum}`)

  const sugg = await page.locator('[data-testid="review-suggestion"]').count()
  if (sugg >= 3 && sugg <= 5) ok('改进建议 3–5 条', `${sugg} 条`)
  else bad('改进建议 3–5 条', `${sugg} 条`)

  // ---------- 文档卡 ----------
  const docCard = await page.locator('text=解析文本').count()
  if (docCard > 0) ok('详情页有成果文档卡', `${docCard} 个入口`)
  else bad('详情页有成果文档卡')

  // 打开解析文本查看器
  await page.locator('button:has-text("解析文本")').first().click()
  await page.waitForTimeout(600)
  const viewerText = await page.locator('[role="dialog"]').innerText()
  if (/闽东山海之间/.test(viewerText)) ok('解析文本可查看', '含文档首句')
  else bad('解析文本可查看', viewerText.slice(0, 60).replace(/\n/g, ' '))
  // 用 Modal 自己的关闭按钮（这个 Modal 没有绑 Esc，硬按会点不到后面的按钮）
  await page.locator('[role="dialog"] button:has-text("关闭")').first().click()
  await page.waitForTimeout(400)

  // ---------- 重新评阅 ----------
  await page.click('[data-testid="review-rerun"]')
  const disabled = await page.locator('[data-testid="review-rerun"]').isDisabled()
  if (disabled) ok('重新评阅进入忙碌态')
  else bad('重新评阅进入忙碌态')
  await page.waitForTimeout(2500)

  // ---------- 列表分数徽标 ----------
  await page.goto(`${BASE}/#/works`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const chips = await page.locator('[data-testid="work-score"]').count()
  if (chips > 0) ok('列表卡片显示分数', `${chips} 个`)
  else bad('列表卡片显示分数')

  await page.screenshot({ path: 'work/shots/review-list.png' })

  // 回详情页截图
  await page.goto(`${BASE}/#/works`, { waitUntil: 'networkidle' })
  // 卡片里没有 <a>，标题与「眼睛」都是 <button>，点标题进详情
  const first = page.locator('article h3 button').first()
  await first.click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'work/shots/review-detail.png', fullPage: false })

  console.log('\n浏览器错误：', errors.length ? errors.slice(0, 4) : '无')
  const failed = results.filter((r) => !r.pass)
  console.log(`\n通过 ${results.length - failed.length} / ${results.length}`)
  await browser.close()
  process.exit(failed.length || errors.length ? 1 : 0)
})()
