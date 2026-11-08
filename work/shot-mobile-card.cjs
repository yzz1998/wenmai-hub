// 手机端：滚到指定卡片再截，node work/shot-mobile-card.cjs <路由> <cardIndex> <out.png>
const { chromium } = require('playwright-core')
const path = require('path')
;(async () => {
  const rel = process.argv[2] || '/#/theme'
  const idx = Number(process.argv[3] || 2)
  const out = path.resolve(process.argv[4] || 'work/shots/mobile-card.png')
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.goto('http://127.0.0.1:5183' + rel, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const card = page.locator('article').nth(idx)
  await card.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await card.screenshot({ path: out })
  console.log('ok', out)
  await browser.close()
})()
