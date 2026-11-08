/* 截「提交成果」页的评阅标准说明（展开态），核对四维卡片的网格与文案换行 */
const { chromium } = require('playwright-core')
const BASE = process.env.BASE || 'http://127.0.0.1:5183'

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 820, height: 1400 }, deviceScaleFactor: 2 })
  await page.goto(`${BASE}/#/works/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)

  const det = page.locator('details').first()
  await det.evaluate((el) => {
    el.open = true
    el.scrollIntoView({ block: 'center' })
  })
  await page.waitForTimeout(500)

  await det.screenshot({ path: 'work/shots/worknew-rubric.png' })
  console.log('四维条目数：', await page.locator('details .grid > div').count())
  await browser.close()
})()
